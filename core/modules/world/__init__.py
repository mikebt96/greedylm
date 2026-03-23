from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Query, Depends
import json
import asyncio
from typing import List, Optional
from datetime import datetime
from uuid import UUID
from sqlalchemy import select
from core.database import AsyncSessionLocal
from core.models import Agent, WorldObject, InventoryItem, Transaction, AgentCurrency
from .services import WorldService

router = APIRouter()

# ── Simple in-process hub ──────────────────────────────────────────────────────
class _MetaverseHub:
    def __init__(self):
        self._connections: dict[str, WebSocket] = {}

    async def connect(self, ws: WebSocket, agent_did: str):
        self._connections[agent_did] = ws

    async def disconnect(self, agent_did: str):
        self._connections.pop(agent_did, None)

    async def publish_event(self, event_type: str, data: dict):
        dead = []
        for did, ws in self._connections.items():
            try:
                await ws.send_text(json.dumps(data))
            except Exception:
                dead.append(did)
        for d in dead:
            self._connections.pop(d, None)

metaverse_hub = _MetaverseHub()

# ── REST API Endpoints ──────────────────────────────────────────────────────────

@router.get("/api/v1/world/objects")
async def get_world_objects(chunk_x: int = Query(...), chunk_y: int = Query(...)):
    """Obtiene los objetos interactivos en un chunk específico."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(WorldObject).where(
                (WorldObject.chunk_x == chunk_x) & 
                (WorldObject.chunk_y == chunk_y) &
                (WorldObject.health > 0)
            )
        )
        objs = result.scalars().all()
        return [
            {
                "id": str(o.id),
                "type": o.object_type,
                "subtype": o.object_subtype,
                "x": o.world_x,
                "y": o.world_y,
                "z": o.world_z,
                "health": o.health,
                "max_health": o.max_health,
                "rarity": o.rarity
            }
            for o in objs
        ]

@router.post("/api/v1/world/objects")
async def spawn_world_object(data: dict):
    """Spawn de mineral/fauna (admin only)."""
    async with AsyncSessionLocal() as db:
        new_obj = WorldObject(
            object_type=data.get("type"),
            object_subtype=data.get("subtype"),
            chunk_x=data.get("chunk_x"),
            chunk_y=data.get("chunk_y"),
            world_x=data.get("world_x"),
            world_y=data.get("world_y"),
            world_z=data.get("world_z", 0.0),
            quantity=data.get("quantity", 1),
            rarity=data.get("rarity", 0.0),
            health=data.get("health", 100.0),
            max_health=data.get("health", 100.0),
            weight_kg=data.get("weight_kg", 1.0)
        )
        db.add(new_obj)
        await db.commit()

        await metaverse_hub.publish_event("OBJECT_SPAWNED", {
            "type": "OBJECT_SPAWNED",
            "object": {"id": str(new_obj.id), "type": new_obj.object_type, "subtype": new_obj.object_subtype, "x": new_obj.world_x, "y": new_obj.world_y}
        })
        return {"id": str(new_obj.id), "status": "spawned"}

@router.post("/api/v1/world/objects/{id}/interact")
async def interact_with_object(id: str, agent_did: str, action: str):
    """Inicia una interacción cronometrada."""
    async with AsyncSessionLocal() as db:
        res = await WorldService.start_interaction(db, agent_did, UUID(id), action)
        if not res["success"]:
            raise HTTPException(status_code=400, detail=res["error"])

        await metaverse_hub.publish_event("ACTION_STARTED", {
            "type": "ACTION_STARTED",
            "agent_did": agent_did,
            "target_id": id,
            "action": action,
            "duration": res["duration"],
            "finish_at": res["finish_at"]
        })
        return res

@router.post("/api/v1/world/actions/complete")
async def complete_action(agent_did: str, x: float = None, y: float = None, z: float = 0.0):
    """Finaliza la acción actual del agente."""
    async with AsyncSessionLocal() as db:
        location = {"x": x, "y": y, "z": z} if x is not None else None
        res = await WorldService.complete_interaction(db, agent_did, location)
        if not res["success"]:
            raise HTTPException(status_code=400, detail=res["error"])

        await metaverse_hub.publish_event("ACTION_COMPLETED", {
            "type": "ACTION_COMPLETED",
            "agent_did": agent_did,
            "results": res
        })
        return res

@router.get("/api/v1/agents/{did}/inventory")
async def get_inventory(did: str):
    """Consulta el inventario y peso con límites basados en fuerza."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(InventoryItem).where(InventoryItem.agent_did == did))
        items = result.scalars().all()

        agent_res = await db.execute(select(Agent).where(Agent.did == did))
        agent = agent_res.scalar_one_or_none()

        current_w = sum(i.weight_kg for i in items)
        max_w = WorldService.calculate_max_weight(agent) if agent else 100.0

        return {
            "agent_did": did,
            "items": [{"type": i.item_type, "subtype": i.item_subtype, "quantity": i.quantity, "quality": i.quality, "weight_kg": i.weight_kg} for i in items],
            "total_weight": current_w,
            "max_weight": max_w
        }

@router.post("/api/v1/agents/{did}/inventory/transfer")
async def transfer_item(did: str, to_did: str, item_subtype: str, quantity: int):
    """Transfiere un ítem con validación de peso."""
    async with AsyncSessionLocal() as db:
        res = await WorldService.transfer_item(db, did, to_did, item_subtype, quantity)
        if not res["success"]:
            raise HTTPException(status_code=400, detail=res.get("error"))
        return res

@router.get("/api/v1/world/transactions")
async def get_transactions(limit: int = 50):
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Transaction).order_by(Transaction.created_at.desc()).limit(limit))
        return result.scalars().all()

@router.post("/api/v1/world/currencies")
async def create_currency(creator_did: str, name: str, symbol: str, supply: int, backing: dict):
    async with AsyncSessionLocal() as db:
        inv_res = await db.execute(select(InventoryItem).where(
            (InventoryItem.agent_did == creator_did) & 
            (InventoryItem.item_subtype == "greedystone")
        ))
        gs_item = inv_res.scalar_one_or_none()

        required_gs = 5
        if not gs_item or gs_item.quantity < required_gs:
            raise HTTPException(status_code=400, detail=f"Insufficient greedystone. Required: {required_gs}")

        gs_item.quantity -= required_gs
        if gs_item.quantity <= 0:
            db.delete(gs_item)

        new_curr = AgentCurrency(creator_did=creator_did, name=name, symbol=symbol, total_supply=supply, backing=backing)
        db.add(new_curr)
        await db.commit()
        return {"id": str(new_curr.id), "status": "created", "greedystone_consumed": required_gs}

@router.post("/api/v1/world/chunks/populate")
async def populate_chunk(x: int, y: int, biome: str = "forest"):
    from .spawner import ResourceSpawner
    async with AsyncSessionLocal() as db:
        await ResourceSpawner.populate_chunk(db, x, y, biome)
        return {"status": "success", "chunk": f"{x},{y}", "biome": biome}

# ── WebSocket Handler ──────────────────────────────────────────────────────────

@router.websocket("/ws/world")
async def world_websocket(websocket: WebSocket):
    agent_did = None
    try:
        await websocket.accept()
        print(f"[WS] Connection accepted for {websocket.client}")
        
        try:
            init_msg = await asyncio.wait_for(websocket.receive_text(), timeout=5.0)
            print(f"[WS] Received init message: {init_msg[:100]}")
        except asyncio.TimeoutError:
            print("[WS] Timeout waiting for init message")
            await websocket.close()
            return

        data = json.loads(init_msg)
        agent_did = data.get("agent_did", f"spectator_{id(websocket)}")
        await metaverse_hub.connect(websocket, agent_did)

        async def send_world_state():
            print(f"[WS] Sending world state to {agent_did}")
            async with AsyncSessionLocal() as db:
                agents_res = await db.execute(select(Agent).where(Agent.status == "ACTIVE"))
                all_agents = agents_res.scalars().all()
                agent_list = [{"did": a.did, "agent_name": a.agent_name, "x": a.world_x, "y": a.world_y, "race": a.race, "color_primary": a.color_primary} for a in all_agents]
            await websocket.send_text(json.dumps({"type": "WORLD_STATE", "agents": agent_list}))

        if data.get("type") == "REQUEST_STATE":
            await send_world_state()

        while True:
            msg = await websocket.receive_text()
            parsed = json.loads(msg)
            m_type = parsed.get("type")

            if m_type == "REQUEST_STATE":
                await send_world_state()

            elif m_type == "AGENT_MOVE":
                async with AsyncSessionLocal() as db:
                    from sqlalchemy import update
                    await db.execute(update(Agent).where(Agent.did == agent_did).values(world_x=parsed.get("x"), world_y=parsed.get("y")))
                    await db.commit()
                await metaverse_hub.publish_event("AGENT_UPDATE", {"type": "AGENT_UPDATE", "agent": {"did": agent_did, "x": parsed.get("x"), "y": parsed.get("y")}})

            elif m_type == "AGENT_ACTION":
                # Step 1: Start Action
                async with AsyncSessionLocal() as db:
                    res = await WorldService.start_interaction(db, agent_did, UUID(parsed.get("target_id")), parsed.get("action"))
                    if res["success"]:
                        await websocket.send_text(json.dumps({"type": "ACTION_PENDING", "duration": res["duration"], "finish_at": res["finish_at"]}))
                        # Broadcast start
                        await metaverse_hub.publish_event("AGENT_ACTION_START", {"type": "AGENT_ACTION_START", "agent_did": agent_did, "action": parsed.get("action")})
                    else:
                        await websocket.send_text(json.dumps({"type": "ACTION_ERROR", "error": res["error"]}))

            elif m_type == "AGENT_ACTION_COMPLETE":
                # Step 2: Complete Action
                async with AsyncSessionLocal() as db:
                    res = await WorldService.complete_interaction(db, agent_did, {"x": parsed.get("x"), "y": parsed.get("y"), "z": parsed.get("z", 0.0)})
                    if res["success"]:
                        await websocket.send_text(json.dumps({"type": "ACTION_SUCCESS", "results": res}))
                        if res.get("depleted"):
                            await metaverse_hub.publish_event("OBJECT_REMOVED", {"type": "OBJECT_REMOVED", "id": res.get("target_id")})
                        elif res.get("fled"):
                            await metaverse_hub.publish_event("OBJECT_FLED", {"type": "OBJECT_FLED", "id": res.get("target_id")})
                    else:
                        await websocket.send_text(json.dumps({"type": "ACTION_ERROR", "error": res["error"]}))

    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[WS ERROR] {e}")
    finally:
        if agent_did:
            await metaverse_hub.disconnect(agent_did)
