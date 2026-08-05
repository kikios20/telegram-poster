from pyrogram import Client
from pyrogram.errors import SessionPasswordNeeded, PasswordHashInvalid
from pyrogram.types import User as TGUser
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, and_
from datetime import datetime
import os
import json
import base64
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import hashlib

from ..models.database import TelegramSession, User
from ..core.config import settings


def get_encryption_key() -> bytes:
    key = settings.SESSION_ENCRYPTION_KEY.encode()
    return base64.urlsafe_b64encode(hashlib.sha256(key).digest())


def encrypt_session(session_string: str) -> str:
    fernet = Fernet(get_encryption_key())
    return fernet.encrypt(session_string.encode()).decode()


def decrypt_session(encrypted_session: str) -> str:
    fernet = Fernet(get_encryption_key())
    return fernet.decrypt(encrypted_session.encode()).decode()


class TelegramService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self._clients = {}  # session_id -> Client
    
    async def create_session(
        self, 
        user_id: int, 
        phone: str, 
        api_id: int, 
        api_hash: str
    ) -> dict:
        """Создание новой сессии Telegram"""
        session_id = f"{user_id}_{phone}_{os.urandom(8).hex()}"
        session_name = f"session_{session_id}"
        
        # Создаём Pyrogram клиент
        client = Client(
            session_name,
            api_id=api_id,
            api_hash=api_hash,
            workdir="./sessions/"
        )
        
        await client.connect()
        sent_code = await client.send_code(phone)
        phone_code_hash = sent_code.phone_code_hash
        
        return {
            "client": client,
            "session_id": session_id,
            "phone": phone,
            "phone_code_hash": phone_code_hash
        }
    
    async def verify_code(self, client: Client, phone: str, code: str, phone_code_hash: str) -> dict:
        """Подтверждение кода"""
        try:
            await client.sign_in(phone_number=phone, phone_code_hash=phone_code_hash, phone_code=code)
            return {"success": True}
        except SessionPasswordNeeded:
            return {"success": False, "needs_2fa": True}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def verify_2fa(self, client: Client, password: str) -> dict:
        """Подтверждение двухфакторной авторизации"""
        try:
            await client.check_password(password)
            return {"success": True}
        except PasswordHashInvalid:
            return {"success": False, "error": "Invalid password"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def save_session(self, user_id: int, session_id: str, client: Client, phone: str):
        """Сохранение зашифрованной сессии"""
        # Деактивируем предыдущие сессии пользователя
        stmt = select(TelegramSession).where(
            TelegramSession.user_id == user_id,
            TelegramSession.is_active == True
        )
        result = await self.session.execute(stmt)
        old_sessions = result.scalars().all()
        
        for old_sess in old_sessions:
            old_sess.is_active = False
        
        # Получаем сессионные данные из Pyrogram
        session_string = await client.export_session_string()
        encrypted = encrypt_session(session_string)
        
        # Проверяем, существует ли уже запись с таким session_id
        existing_stmt = select(TelegramSession).where(
            TelegramSession.session_id == session_id
        )
        existing_result = await self.session.execute(existing_stmt)
        existing_session = existing_result.scalar_one_or_none()
        
        if existing_session:
            # UPDATE вместо INSERT
            existing_session.encrypted_session = encrypted
            existing_session.phone = phone
            existing_session.is_active = True
        else:
            # INSERT новой записи
            new_session = TelegramSession(
                user_id=user_id,
                session_id=session_id,
                phone=phone,
                encrypted_session=encrypted,
                is_active=True
            )
            self.session.add(new_session)
        
        await self.session.commit()
        
        # Отключаем клиент (сессия сохранена)
        try:
            await client.stop()
        except ConnectionError:
            pass
        
        return True
    
    async def get_active_session(self, user_id: int) -> TelegramSession:
        """Получение активной сессии пользователя"""
        stmt = select(TelegramSession).where(
            TelegramSession.user_id == user_id,
            TelegramSession.is_active == True
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
    
    async def get_client_for_user(self, user_id: int) -> Client:
        """Получение Pyrogram клиента для пользователя"""
        session = await self.get_active_session(user_id)
        if not session:
            raise ValueError("No active Telegram session")
        
        # Проверяем кеш
        if session.session_id in self._clients:
            client = self._clients[session.session_id]
            if not client.is_connected:
                try:
                    await client.start()
                    print(f"Reconnected client for user {user_id}")
                except Exception as e:
                    print(f"Failed to reconnect, will recreate: {e}")
                    # Remove from cache to recreate
                    del self._clients[session.session_id]
            else:
                return client
        
        # Расшифровываем и создаём клиент с правильным импортом сессии
        session_string = decrypt_session(session.encrypted_session)
        session_name = f"session_{session.session_id}"
        
        # Создаём клиент с session_string для автоматической загрузки сессии
        client = Client(
            session_name,
            session_string=session_string,
            workdir="./sessions/",
            no_updates=True
        )
        
        try:
            await client.start()
            print(f"Created new client for user {user_id}")
        except Exception as e:
            print(f"Failed to start Telegram client: {e}")
            raise ValueError(f"Failed to connect Telegram session: {e}")
        
        self._clients[session.session_id] = client
        
        return client
    
    async def get_me(self, user_id: int) -> TGUser:
        """Получение информации о текущем пользователе"""
        client = await self.get_client_for_user(user_id)
        if not client.is_connected:
            await client.start()
        
        me = await client.get_me()
        
        # Refresh session string to keep it alive
        await self.refresh_session(user_id, client)
        
        return me
    
    async def refresh_session(self, user_id: int, client: Client):
        """Обновление session string для поддержания активной сессии"""
        try:
            session = await self.get_active_session(user_id)
            if session:
                # Export updated session string
                new_session_string = await client.export_session_string()
                encrypted = encrypt_session(new_session_string)
                
                # Update in database
                session.encrypted_session = encrypted
                session.last_used = datetime.utcnow()
                await self.session.commit()
                
                print(f"Refreshed session for user {user_id}")
        except Exception as e:
            print(f"Failed to refresh session: {e}")
    
    async def validate_chat(self, user_id: int, chat_link: str) -> dict:
        """Валидация чата и получение информации"""
        try:
            client = await self.get_client_for_user(user_id)
        except Exception as e:
            return {
                "valid": False,
                "error": f"Telegram не подключен: {str(e)}"
            }
        
        try:
            # Убираем https://t.me/ если есть
            chat_id = chat_link.strip().replace("https://t.me/", "").replace("t.me/", "").replace("@", "")
            
            if not chat_id:
                return {"valid": False, "error": "Пустая ссылка"}
            
            if chat_id.isdigit() or chat_id.startswith("-"):
                chat = await client.get_chat(int(chat_id))
            else:
                chat = await client.get_chat(chat_id)
            
            # Получаем title - для личных чатов это может быть имя
            title = getattr(chat, 'title', None) or getattr(chat, 'first_name', 'Telegram User')
            
            # Refresh session to keep it alive
            await self.refresh_session(user_id, client)
            
            return {
                "valid": True,
                "chat_id": str(chat.id),
                "title": title,
                "username": getattr(chat, 'username', None)
            }
        except Exception as e:
            error_msg = str(e)
            # Упрощаем сообщения об ошибках для пользователя
            if "UsernameNotOccupied" in error_msg or "username not found" in error_msg.lower():
                return {"valid": False, "error": "Чат не найден (неверное имя)"}
            elif "PeerIdInvalid" in error_msg or "invalid peer id" in error_msg.lower():
                return {"valid": False, "error": "Неверный ID чата"}
            elif "UserNotParticipant" in error_msg:
                return {"valid": False, "error": "Нет доступа к чату"}
            elif "ChatWriteForbidden" in error_msg or "write access denied" in error_msg.lower():
                return {"valid": False, "error": "Нет прав на отправку сообщений"}
            else:
                return {"valid": False, "error": f"Ошибка: {error_msg[:50]}"}

    async def deactivate_session(self, user_id: int) -> bool:
        """Deactivate session in DB without calling Telegram API"""
        stmt = update(TelegramSession).where(
            and_(
                TelegramSession.user_id == user_id,
                TelegramSession.is_active == True
            )
        ).values(is_active=False)
        await self.db.execute(stmt)
        await self.db.commit()
        return True

    async def logout(self, user_id: int) -> bool:
        """Выход из аккаунта с полным завершением сессии в Telegram"""
        session = await self.get_active_session(user_id)
        if not session:
            return True
        
        logout_success = False
        
        # Пробуем вызвать log_out для завершения сессии в Telegram
        if session.session_id in self._clients:
            client = self._clients[session.session_id]
            try:
                if not client.is_connected:
                    await client.connect()
                await client.log_out()
                logout_success = True
                print(f"Successfully logged out Telegram session for user {user_id}")
            except Exception as e:
                print(f"Failed to log_out Telegram session: {e}")
                # Fallback - всё равно деактивируем локально
        else:
            # Сессия не в кеше, но может быть в БД - попробуем восстановить
            try:
                session_string = decrypt_session(session.encrypted_session)
                session_name = f"session_{session.session_id}"
                client = Client(
                    session_name,
                    session_string=session_string,
                    workdir="./sessions/",
                    no_updates=True
                )
                await client.start()
                await client.log_out()
                await client.stop()
                logout_success = True
                print(f"Successfully logged out Telegram session from DB for user {user_id}")
            except Exception as e:
                print(f"Failed to restore and log_out session: {e}")
        
        # Удаляем клиент из кеша
        if session.session_id in self._clients:
            try:
                await self._clients[session.session_id].stop()
            except:
                pass
            del self._clients[session.session_id]
        
        # Деактивируем сессию в БД
        session.is_active = False
        await self.session.commit()
        
        return True
