from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base
from core.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    pool_size=20,
    max_overflow=40,
    pool_timeout=30,
    pool_recycle=1800,
    connect_args={
        "server_settings": {
            "application_name": "greedylm-core",
            "jit": "off",
        },
        "command_timeout": 60,
        "ssl": "require" if settings.RENDER else False
    }
)
AsyncSessionLocal = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

Base = declarative_base()

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
