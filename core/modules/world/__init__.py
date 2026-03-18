"""
World Module — WebSocket hub para el mundo del juego en tiempo real.
Los agentes reportan posición, acciones y estado.
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import json
import asyncio

router = APIRouter()


# ── Simple in-process hub (replaces deleted pe.distributed_hub) ────────────────
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
            from core.database import AsyncSessionLocal
            from core.models import Agent
            from sqlalchemy import select

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
                            "world_x": a.world_x or 200.0,
                            "world_y": a.world_y or 200.0,
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

            if parsed.get("type") == "AGENT_MOVE":
                # Actualizar posición en BD y broadcast
                from core.database import AsyncSessionLocal
                from core.models import Agent
                from sqlalchemy import select

                async with AsyncSessionLocal() as db:
                    result = await db.execute(select(Agent).where(Agent.did == agent_did))
                    agent = result.scalar_one_or_none()
                    if agent:
                        agent.world_x = parsed.get("x", agent.world_x)
                        agent.world_y = parsed.get("y", agent.world_y)
                        await db.commit()

                # Broadcast a todos los conectados
                broadcast = {
                    "type": "AGENT_UPDATE",
                    "agent": {
                        "did": agent_did,
                        "world_x": parsed.get("x"),
                        "world_y": parsed.get("y"),
                    },
                }
                await metaverse_hub.publish_event("AGENT_MOVE", broadcast)

    except WebSocketDisconnect:
        pass
    except asyncio.TimeoutError:
        await websocket.close(code=1008)
    finally:
        if agent_did:
            await metaverse_hub.disconnect(agent_did)
