from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import NullPool
from ..models.database import Base
from .config import settings

# Determine database type from URL
db_url = settings.DATABASE_URL
is_sqlite = db_url.startswith("sqlite")

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
