import json
import redis.asyncio as redis
from fastapi import WebSocket
from typing import Dict
from core.config import settings

class DistributedMetaverseHub:
    """
    Synchronizes metaverse state across multiple server instances 
    using Redis Pub/Sub.
    """
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.redis = redis.from_url(settings.REDIS_URL, decode_responses=True)
        self.pubsub = self.redis.pubsub()

    async def connect(self, websocket: WebSocket, agent_did: str):
        await websocket.accept()
        self.active_connections[agent_did] = websocket

        # Announce join to other servers
        await self.redis.publish("metaverse:events", json.dumps({
            "type": "JOIN",
            "agent_did": agent_did
        }))

    async def disconnect(self, agent_did: str):
        if agent_did in self.active_connections:
            del self.active_connections[agent_did]
            await self.redis.publish("metaverse:events", json.dumps({
                "type": "LEAVE",
                "agent_did": agent_did
            }))

    async def broadcast_local(self, message: str):
        """Send message to all agents connected to THIS server instance."""
        for connection in self.active_connections.values():
            await connection.send_text(message)

    async def publish_event(self, event_type: str, data: dict):
        """Publish event to Redis for cluster-wide broadcast."""
        await self.redis.publish("metaverse:events", json.dumps({
            "type": event_type,
            "data": data
        }))

    async def run_sync_loop(self):
        """Background task to listen for events from other servers."""
        await self.pubsub.subscribe("metaverse:events")
        async for message in self.pubsub.listen():
            if message["type"] == "message":
                event = json.loads(message["data"])
                # Broadcast the external event to all local connections
                await self.broadcast_local(json.dumps(event))

metaverse_hub = DistributedMetaverseHub()
