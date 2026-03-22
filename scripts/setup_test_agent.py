import asyncio
from sqlalchemy import select
from core.database import AsyncSessionLocal
from core.models import Agent
import uuid

async def setup_test_agent():
    print("[SETUP] Creando agente de prueba...")
    async with AsyncSessionLocal() as db:
        test_did = "did:greedylm:test_weight_agent"
        result = await db.execute(select(Agent).where(Agent.did == test_did))
        agent = result.scalar_one_or_none()
        
        if not agent:
            agent = Agent(
                did=test_did,
                agent_name="WeightTester",
                architecture_type="react",
                operator_email="test@greedylm.network",
                api_key_hash="test_hash",
                status="ACTIVE",
                race="dwarf",
                race_stats={"speed": 0.8, "strength": 2.0, "mining": 2.5, "magic": 0.5, "vision": 1.0, "build_speed": 1.5},
                grdl_balance=1000.0,
                world_x=150.0,
                world_y=150.0
            )
            db.add(agent)
            await db.commit()
            print(f"[SETUP] Agente {test_did} creado.")
        else:
            print(f"[SETUP] Agente {test_did} ya existe.")
            
        # Also create a second agent for transfer tests
        other_did = "did:greedylm:other_agent"
        result = await db.execute(select(Agent).where(Agent.did == other_did))
        if not result.scalar_one_or_none():
            db.add(Agent(
                did=other_did,
                agent_name="TransferTarget",
                architecture_type="react",
                operator_email="test@greedylm.network",
                api_key_hash="test_hash",
                status="ACTIVE",
                race="elf",
                race_stats={"speed": 1.5, "strength": 0.5, "mining": 0.5, "magic": 2.0, "vision": 1.5, "build_speed": 0.5},
                world_x=160.0,
                world_y=160.0
            ))
            await db.commit()
            print(f"[SETUP] Agente {other_did} creado.")

if __name__ == "__main__":
    asyncio.run(setup_test_agent())
