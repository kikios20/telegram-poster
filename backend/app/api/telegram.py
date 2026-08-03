from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict
import asyncio

from ..core import get_db
from ..services.telegram_service import TelegramService
from ..models.database import User
from .schemas import (
    TelegramConnect, 
    TelegramCodeVerify, 
    Telegram2FAVerify,
    TelegramStatus,
    ChatValidation,
    ChatValidationResult
)
from .auth import get_current_user

router = APIRouter(prefix="/telegram", tags=["telegram"])

# Временно храним клиенты в памяти во время авторизации
_pending_clients: Dict[str, Dict] = {}

# Защита от повторной обработки (двойной клик)
_processing_sessions: set = set()

# Максимум попыток ввода кода
MAX_CODE_ATTEMPTS = 5


@router.post("/connect")
async def connect_telegram(
    data: TelegramConnect,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Начало подключения Telegram аккаунта"""
    service = TelegramService(db)
    
    try:
        result = await service.create_session(
            user_id=current_user.id,
            phone=data.phone,
            api_id=data.api_id,
            api_hash=data.api_hash
        )
        
        client = result["client"]
        session_id = result["session_id"]
        
        # Сохраняем клиент временно
        _pending_clients[session_id] = {
            "client": client,
            "user_id": current_user.id,
            "phone": data.phone,
            "phone_code_hash": result["phone_code_hash"],
            "attempts": 0
        }
        
        return {
            "status": "code_required",
            "session_id": session_id,
            "message": "Код подтверждения отправлен на ваш Telegram"
        }
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/verify-code")
async def verify_code(
    data: TelegramCodeVerify,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Подтверждение кода из Telegram"""
    # Защита от повторной обработки (двойной клик)
    if data.session_id in _processing_sessions:
        raise HTTPException(status_code=409, detail="Request already in progress")
    _processing_sessions.add(data.session_id)
    
    try:
        if data.session_id not in _pending_clients:
            raise HTTPException(status_code=400, detail="Session not found or expired")
        
        client_info = _pending_clients[data.session_id]
        if client_info["user_id"] != current_user.id:
            raise HTTPException(status_code=403, detail="Unauthorized")
        
        # Проверка лимита попыток
        if client_info.get("attempts", 0) >= MAX_CODE_ATTEMPTS:
            del _pending_clients[data.session_id]
            raise HTTPException(status_code=429, detail="Too many attempts. Please start again with /telegram/connect")
        
        # Увеличиваем счётчик попыток
        client_info["attempts"] += 1
        
        client = client_info["client"]
        service = TelegramService(db)
        
        result = await service.verify_code(
            client, 
            phone=client_info["phone"],
            code=data.code,
            phone_code_hash=client_info["phone_code_hash"]
        )
        
        if not result["success"]:
            if result.get("needs_2fa"):
                return {"status": "2fa_required", "session_id": data.session_id}
            raise HTTPException(status_code=400, detail=result.get("error", "Invalid code"))
        
        # Сохраняем сессию
        await service.save_session(
            user_id=current_user.id,
            session_id=data.session_id,
            client=client,
            phone=client_info.get("phone", "")
        )
        
        # Удаляем из ожидающих
        del _pending_clients[data.session_id]
        
        return {"status": "connected"}
    
    finally:
        _processing_sessions.discard(data.session_id)


@router.post("/verify-2fa")
async def verify_2fa(
    data: Telegram2FAVerify,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Подтверждение двухфакторной авторизации"""
    if data.session_id not in _pending_clients:
        raise HTTPException(status_code=400, detail="Session not found or expired")
    
    client_info = _pending_clients[data.session_id]
    
    # Проверка лимита попыток
    if client_info.get("attempts", 0) >= MAX_CODE_ATTEMPTS:
        del _pending_clients[data.session_id]
        raise HTTPException(status_code=429, detail="Too many attempts. Please start again with /telegram/connect")
    
    # Увеличиваем счётчик попыток
    client_info["attempts"] += 1
    
    client = client_info["client"]
    service = TelegramService(db)
    
    result = await service.verify_2fa(client, data.password)
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error", "Invalid password"))
    
    # Сохраняем сессию
    await service.save_session(
        user_id=current_user.id,
        session_id=data.session_id,
        client=client,
        phone=client_info.get("phone", "")
    )
    
    del _pending_clients[data.session_id]
    
    return {"status": "connected"}


@router.get("/status", response_model=TelegramStatus)
async def get_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Получение статуса подключения Telegram"""
    if db is None:
        return TelegramStatus(connected=False)
    
    service = TelegramService(db)
    session = await service.get_active_session(current_user.id)
    
    if not session:
        return TelegramStatus(connected=False)
    
    try:
        me = await service.get_me(current_user.id)
        return TelegramStatus(
            connected=True,
            phone=me.phone_number,
            username=me.username,
            first_name=me.first_name,
            last_name=me.last_name,
            user_id=me.id
        )
    except Exception:
        return TelegramStatus(
            connected=True,
            phone=session.phone
        )


@router.post("/validate-chat", response_model=ChatValidationResult)
async def validate_chat(
    data: ChatValidation,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Валидация ссылки на чат"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    service = TelegramService(db)
    
    try:
        result = await service.validate_chat(current_user.id, data.link)
        return ChatValidationResult(
            link=data.link,
            valid=result["valid"],
            chat_id=result.get("chat_id"),
            title=result.get("title"),
            error=result.get("error")
        )
    except Exception as e:
        return ChatValidationResult(
            link=data.link,
            valid=False,
            error=str(e)
        )


@router.post("/logout")
async def logout(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Выход из Telegram аккаунта"""
    if db is None:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    service = TelegramService(db)
    await service.logout(current_user.id)
    
    return {"status": "logged_out"}
