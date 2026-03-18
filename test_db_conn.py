import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from core.config import settings

from sqlalchemy import text


async def test_conn():
    print(f"Testing connection to: {settings.DATABASE_URL}")
    try:
        engine = create_async_engine(settings.DATABASE_URL)
        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT 1"))
            print(f"Success: {result.scalar()}")
    except Exception as e:
        print(f"Failed: {e}")


if __name__ == "__main__":
    asyncio.run(test_conn())
