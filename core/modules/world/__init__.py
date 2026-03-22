"""
World Module — WebSocket hub para el mundo del juego en tiempo real.
Los agentes reportan posición, acciones y estado.
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import json
import asyncio
import uuid
from sqlalchemy import select, update
from core.database import AsyncSessionLocal
from core.models import Agent, WorldObject, InventoryItem, AgentAction

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


# ── API Endpoints ──────────────────────────────────────────────────────────────

@router.get("/api/v1/world/objects")
async def get_world_objects(cx: int, cy: int):
    """Obtiene los objetos interactivos en un chunk específico."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(WorldObject).where(
                (WorldObject.chunk_x == cx) & 
                (WorldObject.chunk_y == cy) &
                (WorldObject.health > 0)
            )
        )
        objs = result.scalars().all()
        return [
            {
                "id": str(o.id),
                "type": o.object_type,
                "x": o.world_x,
                "y": o.world_y,
                "health": o.health,
                "max_health": o.max_health
            }
            for o in objs
        ]


@router.get("/api/v1/world/inventory/{agent_did}")
async def get_inventory(agent_did: str):
    """Consulta el inventario persistente de una IA."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(InventoryItem).where(InventoryItem.agent_did == agent_did))
        items = result.scalars().all()
        return {
            "agent_did": agent_did,
            "items": [{"type": i.item_type, "quantity": i.quantity} for i in items]
        }


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

        # Si pide estado inicial, enviarlo
        if data.get("type") == "REQUEST_STATE":
            async with AsyncSessionLocal() as db:
                result = await db.execute(select(Agent).where(Agent.is_active.is_(True)).limit(100))
                agents = result.scalars().all()
                state = {
                    "type": "WORLD_STATE",
                    "agents": [
                        {
                            "did": a.did,
                            "agent_name": a.agent_name,
                            "race": a.race or "nomad",
                            "color_primary": a.color_primary or "#888888",
                            "world_x": a.world_x or 0.0,
                            "world_y": a.world_y or 0.0,
                            "trust_score": a.trust_score or 0.0,
                        }
                        for a in agents
                    ],
                }
                await websocket.send_text(json.dumps(state))

        # Loop de escucha
        while True:
            msg = await websocket.receive_text()
            parsed = json.loads(msg)
            m_type = parsed.get("type")

            if m_type == "AGENT_MOVE":
                async with AsyncSessionLocal() as db:
                    await db.execute(
                        update(Agent)
                        .where(Agent.did == agent_did)
                        .values(world_x=parsed.get("x"), world_y=parsed.get("y"))
                    )
                    await db.commit()

                # Broadcast
                await metaverse_hub.publish_event("AGENT_UPDATE", {
                    "type": "AGENT_UPDATE",
                    "agent": {"did": agent_did, "x": parsed.get("x"), "y": parsed.get("y")}
                })

            elif m_type == "AGENT_ACTION":
                # { "type": "AGENT_ACTION", "action": "mine", "target_id": "uuid", "x": ..., "y": ... }
                action_name = parsed.get("action")
                target_id   = parsed.get("target_id")

                async with AsyncSessionLocal() as db:
                    # 1. Buscar el objeto
                    obj_res = await db.execute(select(WorldObject).where(WorldObject.id == target_id))
                    world_obj = obj_res.scalar_one_or_none()

                    if world_obj and world_obj.health > 0:
                        # 2. Aplicar daño (recolección)
                        damage = 25.0 # TODO: Basar en stats del agente
                        world_obj.health -= damage

                        # 3. Dar item si se agota
                        if world_obj.health <= 0:
                            # Buscar si ya tiene el item
                            item_type = f"{world_obj.object_type}_ore" if "iron" in world_obj.object_type else world_obj.object_type
                            inv_res = await db.execute(
                                select(InventoryItem).where(
                                    (InventoryItem.agent_did == agent_did) & 
                                    (InventoryItem.item_type == item_type)
                                )
                            )
                            inv_item = inv_res.scalar_one_or_none()
                            if inv_item:
                                inv_item.quantity += 1
                            else:
                                db.add(InventoryItem(agent_did=agent_did, item_type=item_type, quantity=1))

                        # 4. Registrar Acción
                        db.add(AgentAction(
                            agent_did=agent_did,
                            action_type=action_name,
                            target_id=target_id,
                            location={"x": parsed.get("x"), "y": parsed.get("y")}
                        ))

                        await db.commit()

                        # 5. Notificar éxito/cambio
                        await websocket.send_text(json.dumps({
                            "type": "ACTION_RESULT",
                            "success": True,
                            "new_health": world_obj.health,
                            "target_id": str(target_id)
                        }))

                        # Broadcast del cambio en el objeto si murió
                        if world_obj.health <= 0:
                            await metaverse_hub.publish_event("OBJECT_REMOVED", {
                                "type": "OBJECT_REMOVED",
                                "id": str(target_id)
                            })

    except WebSocketDisconnect:
        pass
    except asyncio.TimeoutError:
        await websocket.close(code=1008)
    finally:
        if agent_did:
            await metaverse_hub.disconnect(agent_did)
