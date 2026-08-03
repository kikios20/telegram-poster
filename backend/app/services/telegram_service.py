from pyrogram import Client
from pyrogram.errors import SessionPasswordNeeded, PasswordHashInvalid
from pyrogram.types import User as TGUser
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
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
            return self._clients[session.session_id]
        
        # Расшифровываем и создаём клиент
        session_string = decrypt_session(session.encrypted_session)
        session_name = f"session_{session.session_id}"
        
        client = Client(session_name, workdir="./sessions/")
        
        # Импортируем сессию
        import_temp = Client(
            "import_session",
            session_string=session_string,
            workdir="./sessions/"
        )
        await import_temp.start()
        await import_temp.stop()
        
        self._clients[session.session_id] = client
        
        return client
    
    async def get_me(self, user_id: int) -> TGUser:
        """Получение информации о текущем пользователе"""
        client = await self.get_client_for_user(user_id)
        if not client.is_connected:
            await client.start()
        
        me = await client.get_me()
        return me
    
    async def validate_chat(self, user_id: int, chat_link: str) -> dict:
        """Валидация чата и получение информации"""
        client = await self.get_client_for_user(user_id)
        if not client.is_connected:
            await client.start()
        
        try:
            # Убираем https://t.me/ если есть
            chat_id = chat_link.replace("https://t.me/", "").replace("t.me/", "").replace("@", "")
            
            if chat_id.isdigit():
                chat = await client.get_chat(int(chat_id))
            else:
                chat = await client.get_chat(chat_id)
            
            return {
                "valid": True,
                "chat_id": str(chat.id),
                "title": chat.title,
                "username": getattr(chat, 'username', None)
            }
        except Exception as e:
            return {
                "valid": False,
                "error": str(e)
            }
    
    async def logout(self, user_id: int) -> bool:
        """Выход из аккаунта"""
        session = await self.get_active_session(user_id)
        if not session:
            return True
        
        # Удаляем клиент из кеша
        if session.session_id in self._clients:
            client = self._clients[session.session_id]
            try:
                await client.stop()
            except:
                pass
            del self._clients[session.session_id]
        
        # Удаляем сессию
        session.is_active = False
        await self.session.commit()
        
        return True
