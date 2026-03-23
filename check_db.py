import asyncio
from core.database import AsyncSessionLocal
from core.models import Agent
from sqlalchemy import select

async def check():
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Agent))
        agents = result.scalars().all()
        for a in agents:
            print(f"Agent {a.did}: x={a.world_x}, y={a.world_y}, health={a.health}, stamina={a.stamina}, level={a.level}")

if __name__ == "__main__":
    asyncio.run(check())
