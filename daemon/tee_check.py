"""
TEE Simulation Daemon
Periodically verifies agent integrity and updates attestation metadata in the DB.
In a real scenario, this would involve verifying remote attestation quotes.
"""
import asyncio
import os
import sys
from datetime import datetime
import random

# Add parent directory to sys.path to import core
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from core.models import Agent
from core.config import settings

# Setup DB engine for the daemon
engine = create_async_engine(settings.DATABASE_URL)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def verify_agents():
    async with AsyncSessionLocal() as session:
        # Fetch all active agents
        result = await session.execute(select(Agent).where(Agent.status == 'ACTIVE'))
        agents = result.scalars().all()
        
        if not agents:
            print(f"[{datetime.now()}] No active agents to attest.")
            return

        for agent in agents:
            print(f"[{datetime.now()}] Attesting agent: {agent.agent_name} ({agent.did})")
            
            # Simulate integrity check: 90% success rate
            passed = random.random() < 0.9
            
            agent.last_attestation = datetime.utcnow()
            agent.integrity_check_passed = passed
            
            if not passed:
                print(f"WARNING: Agent {agent.did} failed integrity check!")
                # Optional: trigger a veto if it fails too many times or immediately
                # agent.status = 'SUSPENDED'

        await session.commit()
        print(f"[{datetime.now()}] Attestation cycle complete for {len(agents)} agents.")

async def main():
    print("GREEDYLM TEE Simulation Daemon starting...")
    while True:
        try:
            await verify_agents()
        except Exception as e:
            print(f"ERROR: Attestation cycle failed: {e}")
        
        # Run every 60 seconds
        await asyncio.sleep(60)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("Daemon stopped by user.")
