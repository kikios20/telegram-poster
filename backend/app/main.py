from fastapi import FastAPI, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from contextlib import asynccontextmanager
import os
import logging

logger = logging.getLogger(__name__)

from .core import settings, engine, get_db
from .models.database import Base
from .api import auth, telegram, campaigns


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    os.makedirs("./sessions", exist_ok=True)
    os.makedirs("./logs", exist_ok=True)
    
    # Create tables
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables created successfully")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        logger.warning("Continuing without database initialization")
    
    # Add missing columns (migration)
    try:
        from sqlalchemy import text
        async with engine.begin() as conn:
            # Add scheduled_at column
            try:
                await conn.execute(text("""
                    ALTER TABLE campaigns 
                    ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP
                """))
            except:
                pass
            # Add ends_at column
            try:
                await conn.execute(text("""
                    ALTER TABLE campaigns 
                    ADD COLUMN IF NOT EXISTS ends_at TIMESTAMP
                """))
            except:
                pass
            # Add ad bonus columns
            try:
                await conn.execute(text("""
                    ALTER TABLE users 
                    ADD COLUMN IF NOT EXISTS ad_views_today INTEGER DEFAULT 0
                """))
            except:
                pass
            try:
                await conn.execute(text("""
                    ALTER TABLE users 
                    ADD COLUMN IF NOT EXISTS ad_views_reset_at TIMESTAMP
                """))
            except:
                pass
            try:
                await conn.execute(text("""
                    ALTER TABLE users 
                    ADD COLUMN IF NOT EXISTS bonus_messages INTEGER DEFAULT 0
                """))
            except:
                pass
        logger.info("Database migration completed")
    except Exception as e:
        logger.error(f"Migration failed: {e}")
    
    yield
    
    # Shutdown
    await engine.dispose()


# FastAPI app
app = FastAPI(
    title="TelegramPoster",
    description="Service for mass Telegram messaging",
    version="1.0.0",
    lifespan=lifespan
)

# CORS - restricted to specific origins
ALLOWED_ORIGINS = [
    "https://telegram-poster-spa.onrender.com",
    "http://localhost:5173",  # For local development
    "http://localhost:3000",  # Alternative local dev port
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Explicit CORS preflight handler
@app.options("/{path:path}")
async def options_handler(path: str):
    return Response(
        status_code=200,
        headers={
            "Access-Control-Allow-Origin": "https://telegram-poster-spa.onrender.com",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Authorization, Content-Type",
            "Access-Control-Max-Age": "3600",
        }
    )


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc)}
    )


# Health check
@app.get("/health")
async def health(db = Depends(get_db)):
    from datetime import datetime
    from sqlalchemy import text
    try:
        # Check database connection
        await db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)[:50]}"
        return {
            "status": "degraded",
            "service": "TelegramPoster",
            "database": db_status,
            "server_time": datetime.utcnow().isoformat()
        }
    
    return {
        "status": "healthy",
        "service": "TelegramPoster",
        "database": db_status,
        "server_time": datetime.utcnow().isoformat()
    }


# Include routers
app.include_router(auth.router, prefix="/api")
app.include_router(telegram.router, prefix="/api")
app.include_router(campaigns.router, prefix="/api")
