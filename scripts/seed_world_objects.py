import asyncio
import uuid
import random
from core.database import AsyncSessionLocal
from core.models import WorldObject

async def seed_resources():
    print("Seeding world objects near center...")
    async with AsyncSessionLocal() as db:
        # 1. Clear existing (optional for this seed)
        # await db.execute(delete(WorldObject))
        
        # 2. Add some minerals in a few chunks
        resource_types = [
            ("iron", 100),
            ("gold", 100),
            ("herb", 50),
            ("tree", 150)
        ]
        
        objects_created = 0
        for cx in range(-1, 2):
            for cy in range(-1, 2):
                # Spawn 3-5 items per chunk
                for _ in range(random.randint(3, 10)):
                    obj_type, hp = random.choice(resource_types)
                    
                    # Local pos within 32-unit chunk
                    lx = random.uniform(-16, 16)
                    ly = random.uniform(-16, 16)
                    
                    # Global pos
                    wx = cx * 32 + lx
                    wz = cy * 32 + ly
                    
                    new_obj = WorldObject(
                        id=uuid.uuid4(),
                        object_type=obj_type,
                        chunk_x=cx,
                        chunk_y=cy,
                        world_x=wx,
                        world_y=wz, # We use y for 2D coords in some places, Z in others, usually world_y is the depth.
                        health=hp,
                        max_health=hp,
                        object_metadata={"rarity": "common" if obj_type != "gold" else "rare"}
                    )
                    db.add(new_obj)
                    objects_created += 1
        
        await db.commit()
        print(f"Success! Created {objects_created} world objects.")

if __name__ == "__main__":
    asyncio.run(seed_resources())
