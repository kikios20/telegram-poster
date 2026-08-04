from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import NullPool
from ..models.database import Base
from .config import settings
import logging

logger = logging.getLogger(__name__)

# Determine database type from URL
db_url = settings.DATABASE_URL
is_sqlite = db_url.startswith("sqlite")

logger.info(f"Database URL: {db_url}")
logger.info(f"Using SQLite: {is_sqlite}")

# Create engine with appropriate settings
if is_sqlite:
    # SQLite configuration (for local development)
    engine = create_async_engine(
        db_url,
        connect_args={"check_same_thread": False},
        poolclass=NullPool,
        echo=False,
    )
else:
    # PostgreSQL configuration (for production on Render)
    # Convert postgres:// or postgresql:// to postgresql+asyncpg://
    if "://" in db_url:
        prefix = db_url.split("://")[0]
        if prefix in ("postgres", "postgresql"):
            db_url = "postgresql+asyncpg://" + db_url.split("://", 1)[1]
            logger.info(f"Converted to asyncpg URL: {db_url}")
    
    engine = create_async_engine(
        db_url,
        poolclass=NullPool,
        echo=False,
        pool_pre_ping=True,
    )

# Create session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db():
    """Database session dependency"""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    """Initialize database tables"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
