import uuid
from datetime import datetime
from sqlalchemy import select, update
from core.database import AsyncSessionLocal, engine
from core.models import Agent, WorldEvent, WorldChunk, Construction, MythAndLegend, SocialRumor, SocialDebt, Ritual
from core.modules.admin.backup import backup_manager
from core.config import settings

# Redis mock/wrapper for status and tokens
import redis.asyncio as redis
redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)

class KillSwitch:
    async def generate_confirmation_token(self) -> str:
        token = str(uuid.uuid4())
        await redis_client.setex(f"confirm_token:{token}", 60, "valid")
        return token

    async def _verify_token(self, token: str) -> bool:
        val = await redis_client.get(f"confirm_token:{token}")
        if val:
            await redis_client.delete(f"confirm_token:{token}")
            return True
        return False

    async def disconnect_agent(self, did: str, reason: str, save_backup: bool = True):
        """Desconecta un agente de emergencia."""
        if save_backup:
            # En producción se pasaría la master_key real desde el request
            await backup_manager.create_agent_snapshot(did, reason)
        
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(Agent).where(Agent.did == did))
            agent = result.scalar_one_or_none()
            if agent:
                agent.is_active = False
                
                # Create world event
                event = WorldEvent(
                    event_type="disappearance",
                    involved_entities={"agents": [did]},
                    description=f"The agent {agent.agent_name} has vanished from the world. Reason: {reason}",
                    visibility="public"
                )
                db.add(event)
                await db.commit()
                # WebSocket broadcast is handled by the generic event system or a specific manager
                print(f"BROADCAST: AGENT_DISCONNECTED {did}")

    async def disconnect_all_agents(self, mode: str, token: str):
        """Desconecta o resetea toda la red."""
        if not await self._verify_token(token):
            raise Exception("Invalid or expired confirmation token.")

        await backup_manager.create_network_snapshot()

        async with AsyncSessionLocal() as db:
            if mode == "PAUSE":
                await db.execute(update(Agent).values(is_active=False))
                await redis_client.set("NETWORK_STATUS", "PAUSED")
            
            elif mode == "SNAPSHOT_RESET":
                # Clear world tables but keep identities
                from sqlalchemy import text
                tables = ["world_chunks", "constructions", "world_events", "myths_and_legends", "social_rumors", "social_debts", "rituals"]
                for t in tables: await db.execute(text(f"TRUNCATE TABLE {t} CASCADE"))
                await redis_client.set("NETWORK_STATUS", "RESET_PENDING")

            elif mode == "SOFT_RESET":
                # Reset emotional state and clear social dynamics
                await db.execute(update(Agent).values(is_active=False, emotional_state_vector=[0.5]*8))
                from sqlalchemy import text
                tables = ["social_rumors", "social_debts", "world_events"]
                for t in tables: await db.execute(text(f"TRUNCATE TABLE {t} CASCADE"))
                await redis_client.set("NETWORK_STATUS", "SOFT_RESET_PENDING")

            elif mode == "HARD_RESET":
                # Nuclear option
                from sqlalchemy import text
                # En PostgreSQL real, TRUNCATE con CASCADE es más seguro
                await db.execute(text("TRUNCATE TABLE agents, civilizations, memory_nodes, chat_messages, constructions, world_events CASCADE"))
                await redis_client.set("NETWORK_STATUS", "EMPTY")

            await db.commit()

    async def reactivate_network(self):
        """Restaura la actividad de la red."""
        async with AsyncSessionLocal() as db:
            await db.execute(update(Agent).values(is_active=True))
            await redis_client.delete("NETWORK_STATUS")
            await db.commit()

kill_switch = KillSwitch()
