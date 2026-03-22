import asyncio
from core.database import AsyncSessionLocal
from core.models import Agent
from sqlalchemy import select

async def main():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(Agent).limit(1))
        agent = res.scalar()
        if agent:
            print(f"AGENT_DID:{agent.did}")
        else:
            print("AGENT_DID:None")

if __name__ == "__main__":
    asyncio.run(main())
