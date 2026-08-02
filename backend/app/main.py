from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from contextlib import asynccontextmanager
import os

from .core import settings, engine, get_db
from .models.database import Base
from .api import auth, telegram, campaigns


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
    title="TelegramPoster",
    description="Service for mass Telegram messaging",
    version="1.0.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
            "Access-Control-Allow-Origin": "*",
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
async def health():
    return {"status": "ok", "service": "TelegramPoster"}


# Include routers
app.include_router(auth.router, prefix="/api")
app.include_router(telegram.router, prefix="/api")
app.include_router(campaigns.router, prefix="/api")
