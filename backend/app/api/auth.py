from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from jose import JWTError, jwt
from datetime import datetime, timedelta
from typing import Optional
import asyncio
import bcrypt
import time

# Simple in-memory rate limiter for login attempts
class RateLimiter:
    def __init__(self, max_attempts: int = 10, window_seconds: int = 900):
        self.max_attempts = max_attempts  # 10 attempts
        self.window_seconds = window_seconds  # 15 minutes
        self._attempts = {}  # ip -> [(timestamp, success)]
    
    def is_rate_limited(self, ip: str) -> tuple[bool, int]:
        """Returns (is_limited, seconds_until_reset)"""
        now = time.time()
        if ip not in self._attempts:
            return False, 0
        
        # Clean old attempts
        self._attempts[ip] = [
            (ts, s) for ts, s in self._attempts[ip]
            if now - ts < self.window_seconds
        ]
        
        if not self._attempts[ip]:
            del self._attempts[ip]
            return False, 0
        
        failed_attempts = [ts for ts, s in self._attempts[ip] if not s]
        if len(failed_attempts) >= self.max_attempts:
            oldest = min(failed_attempts)
            reset_at = int(oldest + self.window_seconds - now)
            return True, max(0, reset_at)
        
        return False, 0
    
    def record_attempt(self, ip: str, success: bool):
        """Record a login attempt"""
        if ip not in self._attempts:
            self._attempts[ip] = []
        self._attempts[ip].append((time.time(), success))
        
        # Cleanup old entries periodically
        if len(self._attempts[ip]) > self.max_attempts * 2:
            now = time.time()
            self._attempts[ip] = [
                (ts, s) for ts, s in self._attempts[ip]
                if now - ts < self.window_seconds
            ]

rate_limiter = RateLimiter()

from ..core.config import settings
from ..core.database import get_db
from ..models.database import User, TelegramSession, SendLog, generate_api_key
from .schemas import UserCreate, UserLogin, Token, UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")


def verify_password_sync(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode(), hashed_password.encode())


def get_password_hash_sync(password: str) -> str:
    return bcrypt.hashpw(password[:72].encode(), bcrypt.gensalt()).decode()


async def verify_password(plain_password: str, hashed_password: str) -> bool:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, verify_password_sync, plain_password, hashed_password)


async def get_password_hash(password: str) -> str:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, get_password_hash_sync, password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
        user_id = int(user_id)
    except (JWTError, ValueError):
        raise credentials_exception
    
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    
    if user is None:
        raise credentials_exception
    
    return user


@router.post("/register")
async def register(user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    """Register a new user"""
    # Check if email exists
    stmt = select(User).where(User.email == user_data.email)
    result = await db.execute(stmt)
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )
    
    # Create user
    hashed_password = await get_password_hash(user_data.password)
    api_key = generate_api_key()
    
    user = User(
        email=user_data.email,
        hashed_password=hashed_password,
        api_key=api_key
    )
    db.add(user)
    await db.commit()
    
    return {
        "id": user.id,
        "email": user.email,
        "is_premium": user.is_premium,
        "has_telegram": False,
        "tier": user.tier or "free",
        "created_at": user.created_at.isoformat() if user.created_at else None
    }


@router.post("/login", response_model=Token)
async def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    """Login with email and password"""
    # Get client IP
    client_ip = request.client.host if request.client else "unknown"
    
    # Check rate limit
    is_limited, seconds_left = rate_limiter.is_rate_limited(client_ip)
    if is_limited:
        raise HTTPException(
            status_code=429,
            detail=f"Too many login attempts. Try again in {seconds_left} seconds."
        )
    
    stmt = select(User).where(User.email == form_data.username)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    
    if not user or not await verify_password(form_data.password, user.hashed_password):
        rate_limiter.record_attempt(client_ip, success=False)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=403,
            detail="Account is deactivated"
        )
    
    # Record successful login
    rate_limiter.record_attempt(client_ip, success=True)
    
    access_token = create_access_token(data={"sub": str(user.id)})
    return Token(access_token=access_token)


@router.post("/login/api-key", response_model=Token)
async def login_with_api_key(api_key: str, db: AsyncSession = Depends(get_db)):
    """Login with API key"""
    stmt = select(User).where(User.api_key == api_key)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key"
        )
    
    access_token = create_access_token(data={"sub": str(user.id)})
    return Token(access_token=access_token)


# Constants for ad bonus system
AD_BONUS_MESSAGES = 5  # Messages earned per ad view
MAX_AD_VIEWS_PER_DAY = 10  # Maximum ad views per day


@router.post("/claim-ad-bonus")
async def claim_ad_bonus(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Claim bonus messages for watching an ad (placeholder)"""
    now = datetime.utcnow()
    
    # Check if user is basic or vip (ad bonus only for paid tiers to start)
    if current_user.tier == "free":
        return {
            "success": True,
            "bonus_earned": 0,
            "bonus_messages": 0,
            "message": "Upgrade to Basic or VIP to earn bonus messages by watching ads"
        }
    
    # Check and reset ad views counter if needed
    if current_user.ad_views_reset_at is None or now >= current_user.ad_views_reset_at:
        current_user.ad_views_today = 0
        tomorrow = datetime(now.year, now.month, now.day) + timedelta(days=1)
        current_user.ad_views_reset_at = tomorrow
    
    # Check if max views reached
    if current_user.ad_views_today >= MAX_AD_VIEWS_PER_DAY:
        return {
            "success": False,
            "bonus_earned": 0,
            "bonus_messages": current_user.bonus_messages,
            "ad_views_today": current_user.ad_views_today,
            "max_ad_views": MAX_AD_VIEWS_PER_DAY,
            "message": f"Maximum {MAX_AD_VIEWS_PER_DAY} ad views reached for today. Reset at midnight UTC."
        }
    
    # Award bonus
    current_user.ad_views_today += 1
    current_user.bonus_messages += AD_BONUS_MESSAGES
    await db.commit()
    
    return {
        "success": True,
        "bonus_earned": AD_BONUS_MESSAGES,
        "bonus_messages": current_user.bonus_messages,
        "ad_views_today": current_user.ad_views_today,
        "max_ad_views": MAX_AD_VIEWS_PER_DAY,
        "message": f"Earned {AD_BONUS_MESSAGES} bonus messages! You have {current_user.bonus_messages} total bonus messages."
    }


@router.get("/me")
async def get_me(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get current user info with usage limits"""
    from ..services.campaign_service import get_tier_limits
    
    # Check if user has Telegram session
    stmt = select(TelegramSession).where(
        TelegramSession.user_id == current_user.id,
        TelegramSession.is_active == True
    )
    result = await db.execute(stmt)
    has_telegram = result.scalar_one_or_none() is not None
    
    # Get usage statistics
    tier = current_user.tier or "free"
    limits = get_tier_limits(tier)
    
    # Count sent messages in last 24 hours
    one_day_ago = datetime.utcnow() - timedelta(hours=24)
    logs_stmt = select(SendLog).where(
        and_(
            SendLog.user_id == current_user.id,
            SendLog.status == "success",
            SendLog.sent_at >= one_day_ago
        )
    )
    logs_result = await db.execute(logs_stmt)
    sent_today = len(logs_result.scalars().all())
    
    # Calculate remaining (base limit + bonus messages)
    remaining_messages = max(0, limits["daily_limit"] - sent_today) + (current_user.bonus_messages or 0)
    
    # Calculate reset time (next midnight UTC)
    now = datetime.utcnow()
    tomorrow = datetime(now.year, now.month, now.day) + timedelta(days=1)
    reset_at = tomorrow.isoformat()
    
    # Ad bonus info
    ad_bonus = None
    if tier != "free":
        ad_views_reset = current_user.ad_views_reset_at.isoformat() if current_user.ad_views_reset_at else reset_at
        ad_bonus = {
            "ad_views_today": current_user.ad_views_today or 0,
            "max_ad_views": MAX_AD_VIEWS_PER_DAY,
            "bonus_messages": current_user.bonus_messages or 0,
            "reset_at": ad_views_reset
        }
    
    return {
        "id": current_user.id,
        "email": current_user.email,
        "is_premium": current_user.is_premium,
        "has_telegram": has_telegram,
        "tier": tier,
        "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
        "usage": {
            "sent_today": sent_today,
            "daily_limit": limits["daily_limit"],
            "remaining": remaining_messages,
            "reset_at": reset_at,
            "bonus_messages": current_user.bonus_messages or 0
        },
        "ad_bonus": ad_bonus
    }


@router.get("/api-key")
async def get_api_key(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get user's API key"""
    return {"api_key": current_user.api_key}
