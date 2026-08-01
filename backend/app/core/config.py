from pydantic_settings import BaseSettings
from typing import Optional
import os


class Settings(BaseSettings):
    PROJECT_NAME: str = "Kikio Telegram Poster"
    
    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "postgresql+asyncpg://postgres:postgres@localhost:5432/kikio"
    )
    
    # Redis
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    
    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "change-this-in-production-super-secret-key")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    API_KEY_LENGTH: int = 32
    
    # Telegram Limits
    MIN_DELAY_SECONDS: int = 7
    MAX_DELAY_SECONDS: int = 3600
    
    # Session Encryption
    SESSION_ENCRYPTION_KEY: str = os.getenv(
        "SESSION_ENCRYPTION_KEY", 
        "32-byte-encryption-key-here!!"
    )
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
