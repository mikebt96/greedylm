import asyncio
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from core.database import Base

@pytest.fixture(scope="session")
def event_loop():
    """Sobrescribe el event_loop por defecto para que tenga alcance de sesión."""
    policy = asyncio.get_event_loop_policy()
    loop = policy.new_event_loop()
    yield loop
    loop.close()

@pytest_asyncio.fixture(scope="session")
async def db_engine():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    yield engine
    await engine.dispose()

@pytest_asyncio.fixture(scope="function")
async def test_db(db_engine):
    async with db_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    TestingSessionLocal = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)
    async with TestingSessionLocal() as session:
        yield session

    async with db_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

@pytest_asyncio.fixture(scope="session")
async def client():
    from core.main import app
    from httpx import AsyncClient, ASGITransport
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
