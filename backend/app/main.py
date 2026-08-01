from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from contextlib import asynccontextmanager
import os

from .core.config import settings
from .models.database import Base
from .api import auth, telegram, campaigns


# Database setup - поддержка SQLite и PostgreSQL
if settings.DATABASE_URL.startswith("sqlite"):
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
else:
    engine = create_async_engine(settings.DATABASE_URL, echo=False)

async_session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db():
    async with async_session_maker() as session:
        yield session


# Update auth dependency
from .api.auth import get_db as auth_get_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    os.makedirs("./sessions", exist_ok=True)
    os.makedirs("./logs", exist_ok=True)
    
    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    yield
    
    # Shutdown
    await engine.dispose()


# FastAPI app
app = FastAPI(
    title="Kikio Telegram Poster",
    description="Service for mass Telegram messaging",
    version="1.0.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # В production заменить на конкретные домены
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc) if settings.DEBUG else "Internal server error"}
    )


# Health check
@app.get("/health")
async def health():
    return {"status": "ok", "service": "Kikio Telegram Poster"}


# Include routers
app.include_router(auth.router, prefix="/api")
app.include_router(telegram.router, prefix="/api")
app.include_router(campaigns.router, prefix="/api")
