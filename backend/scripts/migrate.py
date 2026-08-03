#!/usr/bin/env python3
"""Database migration management script"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from alembic.config import Config
from alembic import command
from app.core.config import settings
from app.core.database import engine
from app.models.database import Base


def run_migrations():
    """Run all pending migrations"""
    alembic_cfg = Config("alembic.ini")
    alembic_cfg.set_main_option("sqlalchemy.url", settings.DATABASE_URL)
    command.upgrade(alembic_cfg, "head")


def create_migration(message):
    """Create a new migration"""
    alembic_cfg = Config("alembic.ini")
    alembic_cfg.set_main_option("sqlalchemy.url", settings.DATABASE_URL)
    command.revision(alembic_cfg, message=message, autogenerate=True)


def init_db():
    """Initialize database (create all tables)"""
    asyncio.run(_init_db())


async def _init_db():
    """Initialize database tables"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("Database initialized successfully")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python migrate.py [init|migrate|revision]")
        sys.exit(1)
    
    cmd = sys.argv[1]
    
    if cmd == "init":
        init_db()
    elif cmd == "migrate":
        run_migrations()
    elif cmd == "revision":
        msg = sys.argv[2] if len(sys.argv) > 2 else "auto migration"
        create_migration(msg)
    else:
        print(f"Unknown command: {cmd}")
        sys.exit(1)
