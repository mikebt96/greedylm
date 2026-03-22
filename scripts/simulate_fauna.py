import asyncio
import random
from sqlalchemy import select
from core.database import AsyncSessionLocal
from core.models import WorldObject
import uuid

async def simulate_fauna():
    print("[FAUNA] Iniciando simulación de movimiento...")
    while True:
        async with AsyncSessionLocal() as db:
            # 1. Fetch all active creatures
            result = await db.execute(select(WorldObject).where(WorldObject.object_type == "creature", WorldObject.health > 0))
            creatures = result.scalars().all()
            
            for c in creatures:
                # 2. Simple random wander logic
                move_x = random.uniform(-2, 2)
                move_y = random.uniform(-2, 2)
                
                c.world_x += move_x
                c.world_y += move_y
                
                # Keep within chunk boundaries (roughly 100x100 relative to chunk origin)
                # This is a bit simplified since world_x is global
                # world_x = chunk_x * 100 + local_x
                min_x, max_x = c.chunk_x * 100, (c.chunk_x + 1) * 100
                min_y, max_y = c.chunk_y * 100, (c.chunk_y + 1) * 100
                
                c.world_x = max(min_x, min(max_x, c.world_x))
                c.world_y = max(min_y, min(max_y, c.world_y))
            
            await db.commit()
            if creatures:
                print(f"[FAUNA] Actualizadas {len(creatures)} criaturas.")
        
        await asyncio.sleep(5) # Tick rate

if __name__ == "__main__":
    import nest_asyncio
    nest_asyncio.apply()
    asyncio.run(simulate_fauna())
