"""
Quick script to sync DB schema for dev.
"""
from core.database import engine, Base
from core.models import Agent, ChatMessage, SocialPost, ArtifactProposal, PenaltyRecord
import asyncio

async def sync_db():
    async with engine.begin() as conn:
        # For dev, we drop and recreate to ensure schema alignment
        # await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    print("Database schema synchronized.")

if __name__ == "__main__":
    asyncio.run(sync_db())
