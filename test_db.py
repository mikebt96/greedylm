import asyncio
import sys
import asyncpg

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())


async def main():
    try:
        conn = await asyncpg.connect("postgresql://user:password@127.0.0.1:5432/greedylm")
        val = await conn.fetchval("SELECT version();")
        print("Success:", val)
        await conn.close()
    except Exception:
        import traceback

        traceback.print_exc()


asyncio.run(main())
