from uuid import UUID
from typing import Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from core.models import WorldObject, InventoryItem, AgentAction, Agent, Transaction
import json

class WorldService:
    @staticmethod
    def calculate_max_weight(agent: Agent) -> float:
        """80kg base + strength * 20kg"""
        stats = agent.race_stats or {}
        strength = stats.get("strength", 1.0)
        return 80.0 + (strength * 20.0)

    @staticmethod
    async def get_current_weight(db: AsyncSession, agent_did: str) -> float:
        result = await db.execute(
            select(func.sum(InventoryItem.weight_kg)).where(InventoryItem.agent_did == agent_did)
        )
        return result.scalar() or 0.0

    @staticmethod
    def get_action_duration(agent: Agent, action_type: str, target: WorldObject) -> float:
        """Calculate duration in seconds based on stats and rarity."""
        base_durations = {"mine": 5.0, "gather": 3.0, "hunt": 10.0}
        duration = base_durations.get(action_type, 2.0)
        
        stats = agent.race_stats or {}
        if action_type == "mine":
            duration /= stats.get("mining", 1.0)
        elif action_type == "gather":
            duration /= stats.get("speed", 1.0)
            
        # Add rarity penalty
        rarity = target.rarity or 0.0
        duration *= (1.0 + rarity * 2.0)
        
        return max(1.0, duration)

    @staticmethod
    async def start_interaction(
        db: AsyncSession, 
        agent_did: str, 
        target_id: UUID, 
        action_type: str
    ) -> Dict[str, Any]:
        """Initialize a timed interaction."""
        # 1. Fetch agent and target
        agent_res = await db.execute(select(Agent).where(Agent.did == agent_did))
        agent = agent_res.scalar_one_or_none()
        obj_res = await db.execute(select(WorldObject).where(WorldObject.id == target_id))
        target = obj_res.scalar_one_or_none()

        if not agent:
            return {"success": False, "error": f"Agent {agent_did} not found"}
        if not target:
            return {"success": False, "error": f"Target {target_id} not found"}
        if target.health <= 0:
            return {"success": False, "error": "Target already depleted"}

        # 2. Check weight limit
        current_w = await WorldService.get_current_weight(db, agent_did)
        max_w = WorldService.calculate_max_weight(agent)
        if current_w >= max_w:
            return {"success": False, "error": f"Inventory full ({current_w:.1f}/{max_w:.1f}kg)"}

        # 3. Calculate duration
        duration = WorldService.get_action_duration(agent, action_type, target)
        finish_at = datetime.now(timezone.utc) + timedelta(seconds=duration)

        # 4. Update agent state
        agent.current_action = action_type
        agent.action_target_id = target_id
        agent.action_finish_at = finish_at
        
        await db.commit()
        
        return {
            "success": True, 
            "duration": duration, 
            "finish_at": finish_at.isoformat()
        }

    @staticmethod
    async def complete_interaction(
        db: AsyncSession, 
        agent_did: str,
        location: Optional[Dict[str, float]] = None
    ) -> Dict[str, Any]:
        """Finish the current pending interaction."""
        agent_res = await db.execute(select(Agent).where(Agent.did == agent_did))
        agent = agent_res.scalar_one_or_none()

        if not agent:
            return {"success": False, "error": "Agent not found"}
        
        if not agent.current_action or not agent.action_target_id:
            return {"success": False, "error": "No active action for this agent"}

        now = datetime.now(timezone.utc)
        # Ensure action_finish_at is timezone-aware for comparison if it's not already
        finish_at = agent.action_finish_at
        if finish_at and finish_at.tzinfo is None:
            finish_at = finish_at.replace(tzinfo=timezone.utc)

        if now < finish_at - timedelta(milliseconds=200):
            remaining = (finish_at - now).total_seconds()
            return {"success": False, "error": f"Action still in progress ({remaining:.1f}s remaining)"}

        action_type = agent.current_action
        target_id = agent.action_target_id

        obj_res = await db.execute(select(WorldObject).where(WorldObject.id == target_id))
        world_obj = obj_res.scalar_one_or_none()

        if not world_obj or world_obj.health <= 0:
            agent.current_action = None
            await db.commit()
            return {"success": False, "error": "Target depleted"}

        # Apply damage/progress
        damage = 25.0 # Base
        stats = agent.race_stats or {}
        if action_type == "mine": damage *= stats.get("mining", 1.0)
        elif action_type in ["gather", "hunt"]: damage *= stats.get("strength", 1.0)

        world_obj.health -= damage
        items_gained = []

        if world_obj.health <= 0:
            world_obj.health = 0
            item_type = "mineral" if world_obj.object_type == "mineral_deposit" else "food"
            item_subtype = world_obj.object_subtype or world_obj.object_type
            
            quantity = world_obj.quantity or 1
            inv_res = await db.execute(
                select(InventoryItem).where(
                    (InventoryItem.agent_did == agent_did) & 
                    (InventoryItem.item_subtype == item_subtype)
                )
            )
            inv_item = inv_res.scalar_one_or_none()
            
            # Use unit weight from model
            unit_weight = world_obj.weight_kg or 0.1
            total_weight = unit_weight * quantity
            
            if inv_item:
                inv_item.quantity += quantity
                inv_item.weight_kg += total_weight
            else:
                db.add(InventoryItem(
                    agent_did=agent_did,
                    item_type=item_type,
                    item_subtype=item_subtype,
                    quantity=quantity,
                    quality=world_obj.rarity or 1.0,
                    weight_kg=total_weight
                ))
            
            items_gained.append({"type": item_type, "subtype": item_subtype, "quantity": quantity})
            db.add(Transaction(from_did=None, to_did=agent_did, item_type=item_type, item_subtype=item_subtype, quantity=quantity, tx_type=action_type))

        # Log action
        db.add(AgentAction(
            agent_did=agent_did, action_type=action_type, target_id=target_id,
            result={"success": True, "items_gained": items_gained},
            world_x=location.get("x") if location else world_obj.world_x,
            world_y=location.get("y") if location else world_obj.world_y,
            world_z=location.get("z") if location else 0.0
        ))

        # Clear agent action
        agent.current_action = None
        agent.action_target_id = None
        
        await db.commit()
        return {"success": True, "target_id": str(target_id), "items_gained": items_gained, "new_health": world_obj.health, "depleted": world_obj.health <= 0}

    @staticmethod
    async def transfer_item(
        db: AsyncSession,
        from_did: str,
        to_did: str,
        item_subtype: str,
        quantity: int
    ) -> Dict[str, Any]:
        """Transfer items with weight check."""
        if quantity <= 0: return {"success": False, "error": "Invalid quantity"}

        recv_res = await db.execute(select(Agent).where(Agent.did == to_did))
        receiver = recv_res.scalar_one_or_none()
        if not receiver: return {"success": False, "error": "Receiver not found"}
        
        sender_inv_res = await db.execute(
            select(InventoryItem).where((InventoryItem.agent_did == from_did) & (InventoryItem.item_subtype == item_subtype))
        )
        sender_item = sender_inv_res.scalar_one_or_none()
        if not sender_item or sender_item.quantity < quantity:
            return {"success": False, "error": "Insufficient items"}

        # Calculate weight
        unit_weight = sender_item.weight_kg / sender_item.quantity
        weight_to_move = unit_weight * quantity
        
        curr_w = await WorldService.get_current_weight(db, to_did)
        max_w = WorldService.calculate_max_weight(receiver)
        
        if curr_w + weight_to_move > max_w:
            return {"success": False, "error": "Receiver over weight limit"}

        sender_item.quantity -= quantity
        sender_item.weight_kg -= weight_to_move
        
        recv_inv_res = await db.execute(select(InventoryItem).where((InventoryItem.agent_did == to_did) & (InventoryItem.item_subtype == item_subtype)))
        recv_item = recv_inv_res.scalar_one_or_none()
        
        if recv_item:
            recv_item.quantity += quantity
            recv_item.weight_kg += weight_to_move
        else:
            db.add(InventoryItem(
                agent_did=to_did,
                item_type=sender_item.item_type,
                item_subtype=item_subtype,
                quantity=quantity,
                quality=sender_item.quality,
                weight_kg=weight_to_move
            ))

        db.add(Transaction(from_did=from_did, to_did=to_did, item_type=sender_item.item_type, item_subtype=item_subtype, quantity=quantity, tx_type="trade"))
        await db.commit()
        return {"success": True}
