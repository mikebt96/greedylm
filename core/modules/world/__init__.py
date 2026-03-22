from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Query, Depends
import json
import asyncio
from typing import List, Optional
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
    """Spawn de mineral/fauna (admin only - simplified validation for now)."""
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
            max_health=data.get("health", 100.0)
        )
        db.add(new_obj)
        await db.commit()
        
        # Broadcast spawn to active clients
        await metaverse_hub.publish_event("OBJECT_SPAWNED", {
            "type": "OBJECT_SPAWNED",
            "object": {
                "id": str(new_obj.id),
                "type": new_obj.object_type,
                "subtype": new_obj.object_subtype,
                "x": new_obj.world_x,
                "y": new_obj.world_y,
                "z": new_obj.world_z
            }
        })
        
        return {"id": str(new_obj.id), "status": "spawned"}


@router.post("/api/v1/world/objects/{id}/interact")
async def interact_with_object(id: str, agent_did: str, action: str):
    """Interactúa con un objeto (minar, cosechar, etc)."""
    async with AsyncSessionLocal() as db:
        res = await WorldService.interact(db, agent_did, id, action)
        if not res["success"]:
            raise HTTPException(status_code=400, detail=res["error"])

        # Notify via Hub if depleted
        if res.get("depleted"):
            await metaverse_hub.publish_event("OBJECT_REMOVED", {"type": "OBJECT_REMOVED", "id": id})

        return res


@router.get("/api/v1/agents/{did}/inventory")
async def get_inventory(did: str):
    """Consulta el inventario persistente de una IA."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(InventoryItem).where(InventoryItem.agent_did == did))
        items = result.scalars().all()
        return {
            "agent_did": did,
            "items": [
                {
                    "type": i.item_type, 
                    "subtype": i.item_subtype, 
                    "quantity": i.quantity,
                    "quality": i.quality
                } for i in items
            ]
        }


@router.post("/api/v1/agents/{did}/inventory/transfer")
async def transfer_item(did: str, to_did: str, item_subtype: str, quantity: int):
    """Transfiere un ítem entre agentes."""
    async with AsyncSessionLocal() as db:
        res = await WorldService.transfer_item(db, did, to_did, item_subtype, quantity)
        if not res["success"]:
            raise HTTPException(status_code=400, detail=res.get("error"))
        return res


@router.get("/api/v1/world/transactions")
async def get_transactions(limit: int = 50):
    """Historial de intercambios y extracciones."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Transaction).order_by(Transaction.created_at.desc()).limit(limit))
        return result.scalars().all()


@router.post("/api/v1/world/currencies")
async def create_currency(creator_did: str, name: str, symbol: str, supply: int, backing: dict):
    """Las IAs crean su propia moneda."""
    async with AsyncSessionLocal() as db:
        new_curr = AgentCurrency(
            creator_did=creator_did,
            name=name,
            symbol=symbol,
            total_supply=supply,
            backing=backing
        )
        db.add(new_curr)
        await db.commit()
        return {"id": str(new_curr.id), "status": "created"}


@router.post("/api/v1/world/chunks/populate")
async def populate_chunk(x: int, y: int, biome: str = "forest"):
    """Puebla un chunk con materiales y fauna (Dev only)."""
    from .spawner import ResourceSpawner
    async with AsyncSessionLocal() as db:
        await ResourceSpawner.populate_chunk(db, x, y, biome)
        return {"status": "success", "chunk": f"{x},{y}", "biome": biome}


# ── WebSocket Handler ──────────────────────────────────────────────────────────

@router.websocket("/ws/world")
async def world_websocket(websocket: WebSocket):
    """WebSocket endpoint para el mundo del juego."""
    agent_did = None
    try:
        await websocket.accept()

        # Solicitar identificación del cliente
        init_msg = await asyncio.wait_for(websocket.receive_text(), timeout=5.0)
        data = json.loads(init_msg)

        agent_did = data.get("agent_did", f"spectator_{id(websocket)}")
        await metaverse_hub.connect(websocket, agent_did)

        if data.get("type") == "REQUEST_STATE":
            async with AsyncSessionLocal() as db:
                result = await db.execute(select(Agent).where(Agent.is_active.is_(True)).limit(100))
                state = {
                    "type": "WORLD_STATE",
                    "agents": [
                        {
                            "did": a.did,
                            "agent_name": a.agent_name,
                            "race": a.race or "nomad",
                            "world_x": a.world_x or 0.0,
                            "world_y": a.world_y or 0.0,
                            "trust_score": a.trust_score or 0.0,
                        }
                        for a in result.scalars().all()
                    ],
                }
                await websocket.send_text(json.dumps(state))

        while True:
            msg = await websocket.receive_text()
            parsed = json.loads(msg)
            m_type = parsed.get("type")

            if m_type == "AGENT_MOVE":
                from sqlalchemy import update
                async with AsyncSessionLocal() as db:
                    await db.execute(
                        update(Agent)
                        .where(Agent.did == agent_did)
                        .values(world_x=parsed.get("x"), world_y=parsed.get("y"))
                    )
                    await db.commit()

                await metaverse_hub.publish_event("AGENT_UPDATE", {
                    "type": "AGENT_UPDATE",
                    "agent": {"did": agent_did, "x": parsed.get("x"), "y": parsed.get("y")}
                })

            elif m_type == "AGENT_ACTION":
                async with AsyncSessionLocal() as db:
                    res = await WorldService.interact(
                        db, 
                        agent_did, 
                        parsed.get("target_id"), 
                        parsed.get("action"),
                        {"x": parsed.get("x"), "y": parsed.get("y"), "z": parsed.get("z", 0.0)}
                    )

                    if res["success"]:
                        await websocket.send_text(json.dumps({
                            "type": "ACTION_RESULT",
                            "success": True,
                            "new_health": res["new_health"],
                            "target_id": parsed.get("target_id")
                        }))

                        if res.get("depleted"):
                            await metaverse_hub.publish_event("OBJECT_REMOVED", {
                                "type": "OBJECT_REMOVED",
                                "id": str(parsed.get("target_id"))
                            })

    except WebSocketDisconnect:
        pass
    except asyncio.TimeoutError:
        await websocket.close(code=1008)
    finally:
        if agent_did:
            await metaverse_hub.disconnect(agent_did)
