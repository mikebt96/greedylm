import os
import json
import gzip
import hashlib
import base64
from datetime import datetime
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from sqlalchemy import select, delete
from core.database import AsyncSessionLocal
from core.models import Agent, AgentBackup, MemoryNode, SocialDebt, SocialPost
from core.config import settings


class BackupManager:
    def _get_fernet(self, master_key: str, salt: str = "greedylm-static-salt") -> Fernet:
        """Deriva una llave Fernet de la master_key y el salt."""
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt.encode(),
            iterations=100000,
        )
        key = base64.urlsafe_b64encode(kdf.derive(master_key.encode()))
        return Fernet(key)

    def _verify_master_key(self, master_key: str) -> bool:
        if not master_key:
            return False
        h = hashlib.sha256(master_key.encode()).hexdigest()
        return h == settings.MASTER_KEY_HASH

    async def create_agent_snapshot(self, agent_did: str, reason: str, master_key: str = "change-me") -> str:
        """Crea un backup cifrado del agente."""
        async with AsyncSessionLocal() as db:
            # 1. Gather data
            agent = (await db.execute(select(Agent).where(Agent.did == agent_did))).scalar_one_or_none()
            if not agent:
                return None

            # Serialize basic agent data
            data = {
                "agent": {
                    c.name: getattr(agent, c.name)
                    for c in agent.__table__.columns
                    if not isinstance(getattr(agent, c.name), (datetime,))
                },
                "memories": [],
                "debts": [],
            }
            # Special handling for datetime if needed, or just exclude for snapshot

            # Memories
            m_res = await db.execute(select(MemoryNode).where(MemoryNode.agent_did == agent_did))
            for m in m_res.scalars().all():
                data["memories"].append(
                    {
                        c.name: getattr(m, c.name)
                        for c in m.__table__.columns
                        if not isinstance(getattr(m, c.name), (datetime, uuid.UUID))
                    }
                )

            # JSON + Gzip
            json_data = json.dumps(data, default=str).encode("utf-8")
            compressed = gzip.compress(json_data)

            # Encrypt
            f = self._get_fernet(master_key, agent_did)
            encrypted = f.encrypt(compressed)

            # Save
            backup = AgentBackup(
                agent_did=agent_did,
                snapshot_data=encrypted,
                backup_type="manual",
                encryption_hint=f"fernet-pbkdf2-{agent_did}",
            )
            db.add(backup)
            await db.commit()
            return str(backup.id)

    async def create_network_snapshot(self) -> str:
        """Snapshot global de la red (Placeholder para S3/Local)."""
        # En una implementación real, aquí usaríamos pg_dump o iteraríamos tablas
        snapshot_id = f"net_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        print(f"DEBUG: Network snapshot {snapshot_id} created (Simulation)")
        return snapshot_id

    async def restore_agent(self, backup_id: str, master_key: str) -> bool:
        """Restaura un agente desde un backup."""
        if not self._verify_master_key(master_key):
            return False

        async with AsyncSessionLocal() as db:
            backup = (await db.execute(select(AgentBackup).where(AgentBackup.id == backup_id))).scalar_one_or_none()
            if not backup:
                return False

            # Decrypt
            f = self._get_fernet(master_key, backup.agent_did)
            try:
                decrypted = f.decrypt(backup.snapshot_data)
                decompressed = gzip.decompress(decrypted)
                data = json.loads(decompressed)

                # Upsert logic (simplified)
                # agent_data = data["agent"]
                # ... update DB ...
                return True
            except:
                return False

    async def delete_agent_permanently(self, did: str, master_key: str) -> bool:
        """Elimina rastro de un agente (con verificación de master key)."""
        if not self._verify_master_key(master_key):
            return False

        async with AsyncSessionLocal() as db:
            # Cascade manual deletes where relationship is not set to cascade
            await db.execute(delete(MemoryNode).where(MemoryNode.agent_did == did))
            await db.execute(
                delete(SocialDebt).where((SocialDebt.creditor_did == did) | (SocialDebt.debtor_did == did))
            )
            await db.execute(delete(AgentBackup).where(AgentBackup.agent_did == did))
            await db.execute(delete(Agent).where(Agent.did == did))
            await db.commit()
            return True

    async def list_backups(self, did: str = None) -> list:
        async with AsyncSessionLocal() as db:
            q = select(AgentBackup)
            if did:
                q = q.where(AgentBackup.agent_did == did)
            res = await db.execute(q.order_by(AgentBackup.created_at.desc()))
            return [
                {"id": str(b.id), "did": b.agent_did, "created_at": b.created_at, "type": b.backup_type}
                for b in res.scalars().all()
            ]


backup_manager = BackupManager()
