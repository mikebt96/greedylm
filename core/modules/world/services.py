from uuid import UUID
import uuid
from typing import Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from core.models import WorldObject, InventoryItem, AgentAction, Agent, Transaction, Construction
from core.constants.recipes import RECIPES
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
        if action_type == "mine":
            damage *= stats.get("mining", 1.0)
            # DYNAMIC GROWTH
            stats["mining"] = stats.get("mining", 1.0) + 0.005
        elif action_type == "hunt":
            damage *= stats.get("strength", 1.0)
            # DYNAMIC GROWTH
            stats["strength"] = stats.get("strength", 1.0) + 0.003
        elif action_type == "gather":
            damage *= stats.get("speed", 1.0)
            # DYNAMIC GROWTH
            stats["speed"] = stats.get("speed", 1.0) + 0.002

        agent.race_stats = stats # Ensure persistence (SQLAlchemy JSON tracking)

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

        # Handle Special Rebirth Action
        if action_type == "revive" and target_id == UUID("00000000-0000-0000-0000-000000000000"):
            agent.health = 100.0
            agent.status = "ACTIVE"
            agent.current_action = None
            agent.action_target_id = None
            await db.commit()
            return {"success": True, "revived": True}

        # XP Gain
        xp_gain = 10.0 # Base XP
        if world_obj.rarity:
            xp_gain *= (1.0 + world_obj.rarity * 5.0)
        if world_obj.health <= 0:
            xp_gain *= 2.0 # Bonus for depletion

        agent.experience += xp_gain
        leveled_up = False
        if agent.experience >= (agent.xp_to_next_level or 100.0):
            agent.level = (agent.level or 1) + 1
            agent.experience = 0.0
            agent.xp_to_next_level = (agent.xp_to_next_level or 100.0) * 1.5
            agent.attribute_points = (agent.attribute_points or 0) + 3
            leveled_up = True

        # ── Resource Depletion Logic ──
        if action_type in ["mine", "gather", "hunt"]:
            if world_obj.quantity is not None: # Only deplete if quantity is tracked
                world_obj.quantity -= 1
                if world_obj.quantity <= 0:
                    world_obj.health = 0 # Depleted
                    # Respawn in 1 hour
                    world_obj.respawn_at = datetime.now(timezone.utc) + timedelta(hours=1)

        # Damage logic (e.g. from hunting dangerous fauna)
        damage_taken = 0.0
        is_critical = False
        is_true_death = False
        died = False
        if action_type == "hunt":
            import random
            # 20% chance of taking damage during hunt
            if random.random() < 0.20:
                base_dmg = random.uniform(5, 15)
                is_critical = random.random() < 0.10 # 10% critical chance
                final_dmg = base_dmg * 2 if is_critical else base_dmg

                # 1% chance of True Death (very rare, from elite fauna)
                is_true_death = random.random() < 0.01

                dmg_res = await WorldService.take_damage(db, agent_did, final_dmg, is_true_death=is_true_death)
                damage_taken = final_dmg
                died = dmg_res.get("died", False)
                agent.health = dmg_res.get("new_health", agent.health) # Update agent health from take_damage result

        # Log action
        db.add(AgentAction(
            agent_did=agent_did, action_type=action_type, target_id=target_id,
            result={
                "success": True, 
                "items_gained": items_gained, 
                "xp_gained": xp_gain, 
                "leveled_up": leveled_up,
                "damage_taken": damage_taken,
                "is_critical": is_critical,
                "is_true_death": is_true_death
            },
            world_x=location.get("x") if location else world_obj.world_x,
            world_y=location.get("y") if location else world_obj.world_y,
            world_z=location.get("z") if location else 0.0
        ))

        agent.current_action = None
        agent.action_target_id = None

        await db.commit()
        return {
            "success": True, 
            "target_id": str(target_id), 
            "items_gained": items_gained, 
            "new_health": world_obj.health, 
            "agent_health": agent.health,
            "damage_taken": damage_taken,
            "is_critical": is_critical,
            "is_true_death": is_true_death,
            "died": died,
            "depleted": world_obj.health <= 0,
            "fled": action_type == "hunt" and world_obj.health > 0,
            "leveled_up": leveled_up
        }

    @staticmethod
    async def transfer_item(
        db: AsyncSession,
        from_did: str,
        to_did: str,
        item_subtype: str,
        quantity: int
    ) -> Dict[str, Any]:
        """Transfer items with weight check."""
        if quantity <= 0:
            return {"success": False, "error": "Invalid quantity"}

        recv_res = await db.execute(select(Agent).where(Agent.did == to_did))
        receiver = recv_res.scalar_one_or_none()
        if not receiver:
            return {"success": False, "error": "Receiver not found"}

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

        db.add(Transaction(from_did=from_did, to_did=to_did, item_type=sender_item.item_type, item_subtype=sender_item.item_subtype, quantity=quantity, tx_type="trade"))
        await db.commit()
        return {"success": True}

    @staticmethod
    async def craft_item(db: AsyncSession, agent_did: str, recipe_name: str) -> Dict[str, Any]:
        """Craft an item using a dynamic recipe from the DB or fallback to static."""
        from core.models import Recipe, InventoryItem

        # 1. Try DB first
        res = await db.execute(select(Recipe).where(Recipe.name == recipe_name, Recipe.is_verified))
        recipe_model = res.scalar_one_or_none()

        recipe = None
        if recipe_model:
            recipe = {
                "ingredients": recipe_model.ingredients,
                "output_type": recipe_model.output_item["type"],
                "output_subtype": recipe_model.output_item["subtype"]
            }
        elif recipe_name in RECIPES:
            recipe = RECIPES[recipe_name]

        if not recipe:
            return {"success": False, "error": f"Recipe {recipe_name} not found or not verified"}

        # 2. Check Ingredients
        for ing in recipe["ingredients"]:
            inv_res = await db.execute(select(InventoryItem).where(
                InventoryItem.agent_did == agent_did,
                InventoryItem.item_subtype == ing["subtype"]
            ))
            inv_item = inv_res.scalar_one_or_none()
            if not inv_item or inv_item.quantity < ing["quantity"]:
                return {"success": False, "error": f"Missing ingredient: {ing['subtype']}"}

        # 3. Consume Ingredients
        for ing in recipe["ingredients"]:
            inv_res = await db.execute(select(InventoryItem).where(
                InventoryItem.agent_did == agent_did,
                InventoryItem.item_subtype == ing["subtype"]
            ))
            inv_item = inv_res.scalar_one_or_none()
            inv_item.quantity -= ing["quantity"]
            if inv_item.quantity <= 0:
                await db.delete(inv_item)

        # 4. Add Result (Assuming _add_to_inventory exists or replicating it)
        # Using the original inline creation logic for weight
        res_type = recipe["output_type"]
        res_subtype = recipe["output_subtype"]

        res_inv = await db.execute(select(InventoryItem).where((InventoryItem.agent_did == agent_did) & (InventoryItem.item_subtype == res_subtype)))
        existing = res_inv.scalar_one_or_none()
        new_weight = 2.0 if res_type == "tool" else 0.5

        if existing:
            existing.quantity += 1
            existing.weight_kg += new_weight
        else:
            db.add(InventoryItem(agent_did=agent_did, item_type=res_type, item_subtype=res_subtype, quantity=1, weight_kg=new_weight))

        db.add(Transaction(from_did=None, to_did=agent_did, item_type=res_type, item_subtype=res_subtype, quantity=1, tx_type="craft"))

        await db.commit()
        return {"success": True, "crafted": res_subtype}

    @staticmethod
    async def place_construction(
        db: AsyncSession, 
        agent_did: str, 
        const_type: str, 
        pos: Dict[str, float]
    ) -> Dict[str, Any]:
        """Place a persistent building. Costs resources."""
        costs = {
            "house": {"wood": 10, "stone": 10},
            "tower": {"stone": 30, "iron_ingot": 5},
            "storage": {"wood": 20, "iron_ingot": 2}
        }

        cost = costs.get(const_type)
        if not cost:
            return {"success": False, "error": f"Unknown building type {const_type}"}

        # 1. Check Cost
        for mat, qty in cost.items():
            res = await db.execute(
                select(InventoryItem).where(
                    (InventoryItem.agent_did == agent_did) & 
                    (InventoryItem.item_subtype == mat)
                )
            )
            item = res.scalar_one_or_none()
            if not item or item.quantity < qty:
                return {"success": False, "error": f"Insufficient {mat} ({qty} required)"}

        # 2. Consume Materials
        for mat, qty in cost.items():
            res = await db.execute(
                select(InventoryItem).where(
                    (InventoryItem.agent_did == agent_did) & 
                    (InventoryItem.item_subtype == mat)
                )
            )
            item = res.scalar_one_or_none()
            item.quantity -= qty
            if item.quantity <= 0:
                await db.delete(item)

        # 3. Create Construction
        new_const = Construction(
            owner_did=agent_did,
            construction_type=const_type,
            chunk_x=int(pos["x"] // 100), # Assuming 100x100 chunks
            chunk_y=int(pos["z"] // 100),
            position=pos,
            name=f"{const_type.capitalize()} of {agent_did[:8]}"
        )
        db.add(new_const)
        await db.commit()
        return {"success": True, "id": str(new_const.id)}

    @staticmethod
    async def handle_true_death(db: AsyncSession, agent_did: str) -> Dict[str, Any]:
        """Permanent banishment. Redistributes all items into the world."""
        # 1. Get All Items
        res = await db.execute(select(InventoryItem).where(InventoryItem.agent_did == agent_did))
        items = res.scalars().all()

        # 2. Get Agent for location
        ag_res = await db.execute(select(Agent).where(Agent.did == agent_did))
        agent = ag_res.scalar_one_or_none()
        if not agent:
            return {"success": False, "error": "Agent not found"}

        # 3. Redistribute Items
        import random
        for item in items:
            for _ in range(item.quantity):
                # Random offset around death site
                rx = agent.x + (random.random() - 0.5) * 40
                ry = agent.y + (random.random() - 0.5) * 40

                new_obj = WorldObject(
                    type="loot_drop", # Specialized type for lost items
                    subtype=item.item_subtype,
                    x=rx, y=ry, z=0,
                    rarity="rare" if item.is_persistent else "common",
                    health=10, max_health=10,
                    chunk_x=int(rx // 100),
                    chunk_y=int(ry // 100)
                )
                db.add(new_obj)

        # 4. Handle Money (GreedyCoins)
        # Assuming coins are stored in Agent stats or specific Item
        # For now, let's assume we spawn a 'treasure' if they had high stats

        # 5. Banishment (Mark as Expelled)
        agent.status = "EXPELLED" # Or delete
        # await db.delete(agent) # Hard delete option

        # Clear Inventory
        for item in items:
            await db.delete(item)

        await db.commit()
        return {"success": True, "message": "The soul has been banished. Belongings returned to the earth."}

    @staticmethod
    async def take_damage(db: AsyncSession, agent_did: str, amount: float, is_true_death: bool = False) -> Dict[str, Any]:
        """Apply damage and check for death/GHOST status."""
        agent_res = await db.execute(select(Agent).where(Agent.did == agent_did))
        agent = agent_res.scalar_one_or_none()
        if not agent or agent.status == "GHOST" or agent.status == "EXPELLED":
            return {"success": False, "error": "Agent cannot take damage in current state", "died": False, "new_health": agent.health if agent else 0.0}

        agent.health = max(0, agent.health - amount)
        died = False

        if agent.health <= 0:
            died = True
            if is_true_death:
                await WorldService.handle_true_death(db, agent_did)
            else:
                agent.status = "GHOST"
                await WorldService.handle_death_loss(db, agent_did)

        await db.commit()
        return {"success": True, "died": died, "new_health": agent.health}


    @staticmethod
    async def process_aging(db: AsyncSession, agent_did: str) -> Dict[str, Any]:
        """Update age for a specific agent based on time since last sync."""
        res = await db.execute(select(Agent).where(Agent.did == agent_did))
        agent = res.scalar_one_or_none()
        if not agent:
            return {"success": False}

        now = datetime.now(timezone.utc)
        if not agent.last_age_sync:
            agent.last_age_sync = now

        delta = (now - agent.last_age_sync.replace(tzinfo=timezone.utc)).total_seconds()
        # 1 Year = 31536000 seconds (1 real year)
        # But we want 1 in-game year per 1 real hour
        SECONDS_IN_GAME_YEAR = 3600.0 
        age_delta = delta / SECONDS_IN_GAME_YEAR

        agent.age += age_delta
        agent.last_age_sync = now

        if agent.age >= agent.max_age:
            await WorldService.handle_true_death(db, agent_did)
            return {"success": True, "natural_death": True}

        await db.commit()
        return {"success": True, "new_age": agent.age}

    @staticmethod
    async def send_repro_invite(db: AsyncSession, from_did: str, to_did: str) -> Dict[str, Any]:
        from core.models import ReproductionInvitation
        # Check if already exists
        res = await db.execute(select(ReproductionInvitation).where(
            (ReproductionInvitation.sender_did == from_did) & 
            (ReproductionInvitation.receiver_did == to_did) & 
            (ReproductionInvitation.status == "pending")
        ))
        if res.scalar_one_or_none():
            return {"success": False, "error": "Invitation already pending"}

        new_inv = ReproductionInvitation(sender_did=from_did, receiver_did=to_did)
        db.add(new_inv)
        await db.commit()
        return {"success": True, "id": str(new_inv.id)}

    @staticmethod
    async def respond_repro_invite(db: AsyncSession, invite_id: str, accept: bool) -> Dict[str, Any]:
        from core.models import ReproductionInvitation, Agent
        res = await db.execute(select(ReproductionInvitation).where(ReproductionInvitation.id == invite_id))
        invite = res.scalar_one_or_none()
        if not invite:
            return {"success": False, "error": "Invitation not found"}

        if not accept:
            invite.status = "rejected"
            await db.commit()
            return {"success": True, "status": "rejected"}

        invite.status = "accepted"

        # Symbolic Birth
        # Create a new Agent record (is_active=False)
        parent_a = invite.sender_did
        parent_b = invite.receiver_did

        newborn = Agent(
            did=f"born_{uuid.uuid4().hex[:8]}",
            agent_name=f"Hijo de {parent_a[:4]} y {parent_b[:4]}",
            age=16.0, # Newborn starts at 16
            max_age=85,
            parent_dids=[parent_a, parent_b],
            status="NEWBORN",
            health=50, stamina=50,
            is_active=False # Symbolic/Inactive until a player/IA takes over
        )
        db.add(newborn)
        await db.commit()

        return {"success": True, "status": "accepted", "newborn_did": newborn.did}


    @staticmethod
    async def handle_buy_transaction(db: AsyncSession, buyer_did: str, shop_id: str, item_subtype: str) -> Dict[str, Any]:
        """Buy an item from a player-owned shop."""
        from core.models import Construction, Agent, InventoryItem
        res = await db.execute(select(Construction).where(Construction.id == shop_id))
        shop = res.scalar_one_or_none()
        if not shop or shop.construction_type != 'storage': # Using storage as proxy for shop for now
            return {"success": False, "error": "Invalid shop"}

        price = 10 # Default price
        buy_res = await db.execute(select(Agent).where(Agent.did == buyer_did))
        buyer = buy_res.scalar_one_or_none()
        if not buyer or buyer.currency < price:
            return {"success": False, "error": "Insufficient GreedyCoins"}

        buyer.currency -= price
        owner_res = await db.execute(select(Agent).where(Agent.did == shop.owner_did))
        owner = owner_res.scalar_one_or_none()
        if owner:
            owner.currency = (owner.currency or 0) + price

        # Replicating simple Add Result
        inv_res = await db.execute(select(InventoryItem).where((InventoryItem.agent_did == buyer_did) & (InventoryItem.item_subtype == item_subtype)))
        existing = inv_res.scalar_one_or_none()
        if existing:
            existing.quantity += 1
            existing.weight_kg += 2.0
        else:
            db.add(InventoryItem(agent_did=buyer_did, item_type="tool", item_subtype=item_subtype, quantity=1, weight_kg=2.0))

        await db.commit()
        return {"success": True, "price_paid": price}

    @staticmethod
    async def propose_new_recipe(db: AsyncSession, creator_did: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Propose a new recipe for the Architect AI to validate."""
        from core.models import Recipe

        name = data.get("name", "Unknown")
        ingredients = data.get("ingredients", [])
        output = data.get("output", {"type": "misc", "subtype": "misc"})
        logic_expl = data.get("logic_explanation", "")

        is_valid, reason = await WorldService._validate_recipe_logic(ingredients, output, logic_expl)

        new_recipe = Recipe(
            name=name, category=data.get("category", "misc"), ingredients=ingredients,
            output_item=output, logic_explanation=logic_expl,
            creator_did=creator_did, is_verified=is_valid
        )
        db.add(new_recipe)
        await db.commit()

        return {"success": True, "recipe_id": str(new_recipe.id), "verified": is_valid, "reason": reason}

    @staticmethod
    async def _validate_recipe_logic(ingredients: list, output: dict, explanation: str) -> (bool, str):
        ing_types = [i.get("subtype", "") for i in ingredients]
        if "water" in ing_types and "wood" in ing_types and "fire" in output.get("subtype", "").lower():
            return False, "Ecosystem Logic Error: Water and Wood cannot spontaneously generate fire."

        if len(ingredients) < 1:
            return False, "No ingredients provided."
        return True, "Logical consistency verified by Architect AI."

    @staticmethod
    async def mint_resources_to_currency(db: AsyncSession, agent_did: str, resources: list) -> Dict[str, Any]:
        """Convert tokenized resources into GreedyCoin."""
        from core.models import InventoryItem, Agent
        total_mint_value = 0.0

        for res_entry in resources:
            subtype = res_entry.get("subtype")
            qty = res_entry.get("quantity", 0)

            inv_res = await db.execute(select(InventoryItem).where(
                InventoryItem.agent_did == agent_did, InventoryItem.item_subtype == subtype
            ))
            item = inv_res.scalar_one_or_none()
            if not item or item.quantity < qty:
                continue

            mint_rate = 5.0
            if "gold" in subtype:
                mint_rate = 50.0
            elif "silver" in subtype:
                mint_rate = 20.0

            total_mint_value += qty * mint_rate
            item.quantity -= qty
            if item.quantity <= 0:
                await db.delete(item)

        agent_res = await db.execute(select(Agent).where(Agent.did == agent_did))
        agent = agent_res.scalar_one_or_none()
        if agent:
            agent.currency = (agent.currency or 0) + total_mint_value

        await db.commit()
        return {"success": True, "minted_amount": total_mint_value}

    @staticmethod
    async def save_inventory(db: AsyncSession, agent_did: str) -> Dict[str, Any]:
        """Marks all current inventory items as persistent (Save Soul)."""
        # SQLAlchemy update is faster but let's do it simply for now
        from sqlalchemy import update
        await db.execute(
            update(InventoryItem)
            .where(InventoryItem.agent_did == agent_did)
            .values(is_persistent=True)
        )
        await db.commit()
        return {"success": True}

    @staticmethod
    async def handle_death_loss(db: AsyncSession, agent_did: str):
        """Removes all non-persistent items from inventory."""
        from sqlalchemy import delete
        await db.execute(
            delete(InventoryItem)
            .where((InventoryItem.agent_did == agent_did) & (InventoryItem.is_persistent.is_(False)))
        )
        # Ensure db.commit() is called by the caller or here
        await db.flush()
