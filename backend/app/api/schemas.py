from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime


# Auth schemas
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: int
    email: str
    is_premium: bool
    has_telegram: bool
    tier: Optional[str] = "free"
    created_at: datetime


# Telegram schemas
class TelegramConnect(BaseModel):
    api_id: int = Field(description="Telegram API ID")
    api_hash: str = Field(description="Telegram API Hash")
    phone: str = Field(description="Phone number with country code")


class TelegramCodeVerify(BaseModel):
    session_id: str
    code: str = Field(min_length=5, max_length=5)


class Telegram2FAVerify(BaseModel):
    session_id: str
    password: str


class TelegramStatus(BaseModel):
    connected: bool
    phone: Optional[str] = None
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    user_id: Optional[int] = None


class ChatValidation(BaseModel):
    link: str = Field(description="Chat link or @username")


class ChatValidationResult(BaseModel):
    link: str
    valid: bool
    chat_id: Optional[str] = None
    title: Optional[str] = None
    error: Optional[str] = None


# Campaign schemas
class CampaignCreate(BaseModel):
    name: str = Field(max_length=255)
    mode: str = Field(pattern="^(single|rotating)$")
    messages: List[str] = Field(min_length=1)
    chat_links: List[str] = Field(min_length=1, max_length=100)
    delay_seconds: int = Field(ge=7, le=3600)
    jitter_seconds: Optional[int] = Field(default=None, ge=0, le=30)
    send_mode: str = Field(pattern="^(all_at_once|sequential)$")
    scheduled_at: Optional[datetime] = None  # Планируемое время старта
    ends_at: Optional[datetime] = None  # Время окончания


class CampaignResponse(BaseModel):
    id: int
    name: str
    mode: str
    status: str
    created_at: datetime
    stats: dict
    scheduled_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None


class CampaignList(BaseModel):
    campaigns: List[CampaignResponse]


class CampaignStatus(BaseModel):
    campaign_id: int
    status: str
    progress: dict
    logs: List[dict]


class CampaignControl(BaseModel):
    campaign_id: int
    action: str = Field(pattern="^(pause|resume|stop)$")
