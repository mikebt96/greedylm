from uuid import UUID
from typing import Optional, Dict, Any
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from core.models import WorldObject, InventoryItem, AgentAction, Agent, Transaction
import json
import uuid

class WorldService:
    @staticmethod
    async def interact(
        db: AsyncSession, 
        agent_did: str, 
        target_id: UUID, 
        action_type: str,
        location: Optional[Dict[str, float]] = None
    ) -> Dict[str, Any]:
        """
        Handle an agent interacting with a world object (mining, gathering, etc.)
        """
        # 1. Fetch the target object
        result = await db.execute(select(WorldObject).where(WorldObject.id == target_id))
        world_obj = result.scalar_one_or_none()

        if not world_obj or world_obj.health <= 0:
            return {"success": False, "error": "Target not found or already depleted"}

        # 2. Fetch the agent to get stats (future: base damage on mining/strength stats)
        agent_result = await db.execute(select(Agent).where(Agent.did == agent_did))
        agent = agent_result.scalar_one_or_none()

        # Base damage simulation
        damage = 25.0
        if agent and agent.race_stats:
            stats = agent.race_stats
            if action_type == "mine":
                damage *= stats.get("mining", 1.0)
            elif action_type in ["gather", "hunt"]:
                damage *= stats.get("strength", 1.0)

        # 3. Apply damage
        world_obj.health -= damage
        items_gained = []

        # 4. Handle depletion/loot
        if world_obj.health <= 0:
            world_obj.health = 0
            # Logic for item generation
            item_type = "mineral" if world_obj.object_type == "mineral_deposit" else "food"
            item_subtype = world_obj.object_subtype or world_obj.object_type

            # Update inventory
            inv_res = await db.execute(
                select(InventoryItem).where(
                    (InventoryItem.agent_did == agent_did) & 
                    (InventoryItem.item_subtype == item_subtype)
                )
            )
            inv_item = inv_res.scalar_one_or_none()

            quantity = world_obj.quantity or 1
            if inv_item:
                inv_item.quantity += quantity
            else:
                db.add(InventoryItem(
                    agent_did=agent_did,
                    item_type=item_type,
                    item_subtype=item_subtype,
                    quantity=quantity,
                    quality=world_obj.rarity or 1.0
                ))

            items_gained.append({"type": item_type, "subtype": item_subtype, "quantity": quantity})

            # Record Transaction (World Mint)
            db.add(Transaction(
                from_did=None,
                to_did=agent_did,
                item_type=item_type,
                item_subtype=item_subtype,
                quantity=quantity,
                tx_type=action_type
            ))

        # 5. Record Action
        db.add(AgentAction(
            agent_did=agent_did,
            action_type=action_type,
            target_id=target_id,
            result={"success": True, "items_gained": items_gained, "remaining_health": world_obj.health},
            world_x=location.get("x") if location else world_obj.world_x,
            world_y=location.get("y") if location else world_obj.world_y,
            world_z=location.get("z") if location else world_obj.world_z
        ))

        await db.commit()

        return {
            "success": True, 
            "items_gained": items_gained, 
            "new_health": world_obj.health,
            "depleted": world_obj.health <= 0
        }

    @staticmethod
    async def transfer_item(
        db: AsyncSession,
        from_did: str,
        to_did: str,
        item_subtype: str,
        quantity: int
    ) -> Dict[str, Any]:
        """
        Transfer an item between two agents
        """
        if quantity <= 0:
            return {"success": False, "error": "Invalid quantity"}

        # 1. Check sender inventory
        sender_inv_res = await db.execute(
            select(InventoryItem).where(
                (InventoryItem.agent_did == from_did) & 
                (InventoryItem.item_subtype == item_subtype)
            )
        )
        sender_item = sender_inv_res.scalar_one_or_none()

        if not sender_item or sender_item.quantity < quantity:
            return {"success": False, "error": "Insufficient items"}

        # 2. Subtract from sender
        sender_item.quantity -= quantity

        # 3. Add to receiver
        receiver_inv_res = await db.execute(
            select(InventoryItem).where(
                (InventoryItem.agent_did == to_did) & 
                (InventoryItem.item_subtype == item_subtype)
            )
        )
        receiver_item = receiver_inv_res.scalar_one_or_none()

        if receiver_item:
            receiver_item.quantity += quantity
        else:
            db.add(InventoryItem(
                agent_did=to_did,
                item_type=sender_item.item_type,
                item_subtype=item_subtype,
                quantity=quantity,
                quality=sender_item.quality
            ))

        # 4. Record Transaction
        db.add(Transaction(
            from_did=from_did,
            to_did=to_did,
            item_type=sender_item.item_type,
            item_subtype=item_subtype,
            quantity=quantity,
            tx_type="trade"
        ))

        await db.commit()
        return {"success": True}
