import random
import uuid
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from core.models import WorldObject

MINERAL_TABLE = [
    {"subtype": "iron_ore", "rarity": 0.10, "prob": 0.35, "biomes": ["volcanic", "caverns"]},
    {"subtype": "copper_ore", "rarity": 0.15, "prob": 0.25, "biomes": ["plains", "forest"]},
    {"subtype": "silver_ore", "rarity": 0.35, "prob": 0.15, "biomes": ["snow", "ruins"]},
    {"subtype": "gold_ore", "rarity": 0.55, "prob": 0.08, "biomes": ["desert", "mythic"]},
    {"subtype": "luminos_gem", "rarity": 0.75, "prob": 0.04, "biomes": ["mythic_zones"]},
    {"subtype": "void_crystal", "rarity": 0.90, "prob": 0.02, "biomes": ["caverns"]},
    {"subtype": "greedystone", "rarity": 1.00, "prob": 0.005, "biomes": ["any"]}
]

FAUNA_TABLE = [
    {"subtype": "luminos_beast", "biomes": ["mythic"], "prob": 0.2, "behavior": "passive_flee"},
    {"subtype": "grubmole", "biomes": ["caverns"], "prob": 0.4, "behavior": "passive"},
    {"subtype": "duskfox", "biomes": ["forest"], "prob": 0.3, "behavior": "shy_attack"},
    {"subtype": "sandscuttler", "biomes": ["desert"], "prob": 0.5, "behavior": "passive"},
    {"subtype": "frosthorn", "biomes": ["snow"], "prob": 0.2, "behavior": "herd"},
    {"subtype": "ashcrawler", "biomes": ["volcanic"], "prob": 0.3, "behavior": "aggressive"}
]

class ResourceSpawner:
    @staticmethod
    def _get_eligible(table: List[dict], biome: str) -> List[dict]:
        eligible = []
        for item in table:
            if "any" in item["biomes"] or biome in item["biomes"]:
                eligible.append(item)
        return eligible

    @staticmethod
    async def populate_chunk(db: AsyncSession, chunk_x: int, chunk_y: int, biome: str, count: int = 5):
        """
        Populate a chunk with minerals and fauna based on biome probabilities.
        """
        # Minerals
        eligible_minerals = ResourceSpawner._get_eligible(MINERAL_TABLE, biome)
        if eligible_minerals:
            for _ in range(count):
                mineral = random.choices(eligible_minerals, weights=[m["prob"] for m in eligible_minerals], k=1)[0]
                await ResourceSpawner._spawn_obj(db, chunk_x, chunk_y, "mineral_deposit", mineral)

        # Fauna
        eligible_fauna = ResourceSpawner._get_eligible(FAUNA_TABLE, biome)
        if eligible_fauna:
            for _ in range(max(1, count // 2)):
                if random.random() < 0.3: # 30% chance to spawn fauna per slot
                    fauna = random.choices(eligible_fauna, weights=[f["prob"] for f in eligible_fauna], k=1)[0]
                    await ResourceSpawner._spawn_obj(db, chunk_x, chunk_y, "creature", fauna)
        
        await db.commit()

    @staticmethod
    async def _spawn_obj(db: AsyncSession, chunk_x: int, chunk_y: int, obj_type: str, spec: dict):
        local_x = random.uniform(0, 100)
        local_y = random.uniform(0, 100)
        world_x = chunk_x * 100 + local_x
        world_y = chunk_y * 100 + local_y

        new_obj = WorldObject(
            object_type=obj_type,
            object_subtype=spec["subtype"],
            chunk_x=chunk_x,
            chunk_y=chunk_y,
            world_x=world_x,
            world_y=world_y,
            world_z=0.0,
            rarity=spec.get("rarity", 0.1),
            quantity=random.randint(1, 10) if obj_type == "creature" else random.randint(5, 20),
            health=100.0,
            max_health=100.0,
            object_metadata={"behavior": spec.get("behavior", "passive")}
        )
        db.add(new_obj)
