from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import json

Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    api_key = Column(String(64), unique=True, index=True)
    is_active = Column(Boolean, default=True)
    is_premium = Column(Boolean, default=False)
    tier = Column(String(20), default="free")  # free, basic, vip
    tier_expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    telegram_sessions = relationship("TelegramSession", back_populates="user", cascade="all, delete-orphan")
    campaigns = relationship("Campaign", back_populates="user", cascade="all, delete-orphan")
    logs = relationship("SendLog", back_populates="user", cascade="all, delete-orphan")


class TelegramSession(Base):
    __tablename__ = "telegram_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    session_id = Column(String(64), unique=True, index=True)
    phone = Column(String(20))
    encrypted_session = Column(Text)  # Зашифрованная сессия Pyrogram
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_used = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="telegram_sessions")


class Campaign(Base):
    __tablename__ = "campaigns"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(255))
    mode = Column(String(20))  # "single" или "rotating"
    messages = Column(JSON)  # Список сообщений
    chat_links = Column(JSON)  # Список ссылок на чаты
    delay_seconds = Column(Integer, default=10)
    jitter_seconds = Column(Integer, default=2)  # Разброс задержки
    send_mode = Column(String(20))  # "all_at_once" или "sequential"
    status = Column(String(20), default="pending")  # pending, running, paused, completed, stopped
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = relationship("User", back_populates="campaigns")
    logs = relationship("SendLog", back_populates="campaign", cascade="all, delete-orphan")


class SendLog(Base):
    __tablename__ = "send_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=True)
    chat_id = Column(String(64))
    chat_title = Column(String(255))
    message_index = Column(Integer)
    status = Column(String(20))  # success, failed, pending
    error_message = Column(Text, nullable=True)
    sent_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="logs")
    campaign = relationship("Campaign", back_populates="logs")


def generate_api_key():
    return uuid.uuid4().hex + uuid.uuid4().hex[:32]
