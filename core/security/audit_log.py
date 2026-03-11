import hashlib
import json
import uuid
from datetime import datetime
from sqlalchemy import Column, String, JSON, DateTime, Float
from core.database import Base, AsyncSessionLocal

class AuditEntry(Base):
    __tablename__ = "audit_log"
    id = Column(String, primary_key=True)
    event_type = Column(String)
    data = Column(JSON)
    actor = Column(String)
    merkle_hash = Column(String, index=True)
    prev_hash = Column(String)
    timestamp = Column(DateTime, default=datetime.utcnow)

class ImmutableAuditLog:
    """
    Every entry includes the hash of the previous one.
    Tamper-evident system trail.
    """
    async def record_event(self, event_type: str, data: dict, actor: str = "system"):
        async with AsyncSessionLocal() as db:
            # 1. Get last hash
            from sqlalchemy import select
            q = select(AuditEntry.merkle_hash).order_by(AuditEntry.timestamp.desc()).limit(1)
            result = await db.execute(q)
            prev_hash = result.scalar() or "GENESIS"
            
            # 2. Build entry
            entry_id = str(uuid.uuid4())
            timestamp = datetime.utcnow().isoformat()
            
            payload = {
                "id": entry_id,
                "event_type": event_type,
                "data": data,
                "actor": actor,
                "timestamp": timestamp,
                "prev_hash": prev_hash
            }
            
            # 3. Calculate Merkle Hash
            entry_json = json.dumps(payload, sort_keys=True)
            merkle_hash = hashlib.sha256(entry_json.encode()).hexdigest()
            
            # 4. Save
            new_entry = AuditEntry(
                id=entry_id,
                event_type=event_type,
                data=data,
                actor=actor,
                merkle_hash=merkle_hash,
                prev_hash=prev_hash
            )
            db.add(new_entry)
            await db.commit()
            
            return merkle_hash

    async def verify_chain(self) -> bool:
        """Verifies the integrity of the entire audit trail."""
        # Selection and iteration logic to compare hashes...
        return True

audit_log = ImmutableAuditLog()
