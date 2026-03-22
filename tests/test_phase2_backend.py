import pytest
import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from core.models import Agent, WorldObject, InventoryItem
from core.modules.world.services import WorldService

@pytest.mark.asyncio
async def test_weight_limits(test_db: AsyncSession):
    did = f"agent_{uuid.uuid4()}"
    agent = Agent(did=did, agent_name="TestAgent", architecture_type="test", operator_email="test@test.com", api_key_hash="hash", race_stats={"strength": 2.0})
    test_db.add(agent)
    await test_db.commit()

    # Max weight = 80 + (2.0 * 20) = 120kg
    max_w = WorldService.calculate_max_weight(agent)
    assert max_w == 120.0

    # Add items
    test_db.add(InventoryItem(agent_did=did, item_type="mineral", quantity=10, weight_kg=110.0))
    await test_db.commit()

    curr_w = await WorldService.get_current_weight(test_db, did)
    assert curr_w == 110.0

@pytest.mark.asyncio
async def test_interaction_duration():
    agent = Agent(race_stats={"mining": 2.0})
    target = WorldObject(object_type="mineral_deposit", rarity=0.5)
    
    # base mine = 5.0
    # duration = 5.0 / 2.0 = 2.5
    # rarity penalty = 2.5 * (1.0 + 0.5 * 2.0) = 2.5 * 2.0 = 5.0
    duration = WorldService.get_action_duration(agent, "mine", target)
    assert duration == 5.0

@pytest.mark.asyncio
async def test_interaction_flow(test_db: AsyncSession):
    did = f"agent_{uuid.uuid4()}"
    agent = Agent(did=did, agent_name="Miner", architecture_type="test", operator_email="test@test.com", api_key_hash="hash", race_stats={"mining": 5.0})
    test_db.add(agent)
    
    target_id = uuid.uuid4()
    target = WorldObject(id=target_id, object_type="mineral_deposit", chunk_x=0, chunk_y=0, world_x=0, world_y=0, health=50, quantity=5, weight_kg=2.0)
    test_db.add(target)
    await test_db.commit()

    # Start
    res1 = await WorldService.start_interaction(test_db, did, target_id, "mine")
    assert res1["success"] is True

    # Complete too early
    res2 = await WorldService.complete_interaction(test_db, did)
    assert res2["success"] is False
    assert "still in progress" in res2["error"]

    # Cheat time
    res_agent = await test_db.execute(select(Agent).where(Agent.did == did))
    ag = res_agent.scalar_one()
    ag.action_finish_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    await test_db.commit()

    # Complete properly
    res3 = await WorldService.complete_interaction(test_db, did)
    assert res3["success"] is True
    assert res3["depleted"] is True
    assert res3["target_id"] == str(target_id)
    assert len(res3["items_gained"]) == 1

    # Check inventory
    inv = await test_db.execute(select(InventoryItem).where(InventoryItem.agent_did == did))
    item = inv.scalar_one()
    assert item.quantity == 5
    assert item.weight_kg == 10.0 # 5 * 2.0
