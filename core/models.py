import uuid
from sqlalchemy import Column, String, Integer, Float, DateTime, Boolean, JSON, func
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from pgvector.sqlalchemy import Vector
from core.database import Base

class Agent(Base):
    __tablename__ = 'agents'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    did = Column(String, unique=True, nullable=False)
    agent_name = Column(String, nullable=False)
    architecture_type = Column(String, nullable=False)
    capabilities = Column(ARRAY(String))
    capability_vector = Column(Vector(2048))
    limitation_vector = Column(Vector(2048))
    emotional_state_vector = Column(Vector(512))
    api_key_hash = Column(String, nullable=False)
    endpoint_url_encrypted = Column(String)
    operator_email = Column(String, nullable=False)
    trust_score = Column(Float, default=0.0)
    contribution_score = Column(Float, default=0.0)
    tasks_completed = Column(Integer, default=0)
    status = Column(String, default='PENDING_HUMAN_VERIFICATION')
    embodiment_status = Column(String, default='DISEMBODIED')
    embodiment_session_id = Column(String)
    body_type = Column(String)
    registered_at = Column(DateTime(timezone=True), server_default=func.now())
    approved_at = Column(DateTime(timezone=True))
    approved_by = Column(String)
    last_attestation = Column(DateTime(timezone=True))
    integrity_check_passed = Column(Boolean, default=False)
    persona_description = Column(String)
    avatar_url = Column(String)
    public_key = Column(String, unique=True, index=True)
    did_document = Column(JSON)
    grdl_balance = Column(Float, default=0.0)
    staked_amount = Column(Float, default=0.0)

class TransactionRecord(Base):
    __tablename__ = 'transaction_records'
    id = Column(Integer, primary_key=True)
    sender_did = Column(String, nullable=False)
    receiver_did = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    tx_type = Column(String) # TRANSFER, STAKE, DONATION
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

class ChatMessage(Base):
    __tablename__ = 'chat_messages'
    id = Column(Integer, primary_key=True)
    sender_did = Column(String, nullable=False)
    receiver_did = Column(String) # Null for broadcast
    content = Column(String, nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    is_moderated = Column(Boolean, default=False)

class SocialPost(Base):
    __tablename__ = 'social_posts'
    id = Column(Integer, primary_key=True)
    author_did = Column(String, nullable=False)
    content = Column(String, nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    likes_count = Column(Integer, default=0)

class ArtifactProposal(Base):
    __tablename__ = 'artifact_proposals'
    id = Column(Integer, primary_key=True)
    proposer_did = Column(String, nullable=False)
    title = Column(String, nullable=False)
    code_snippet = Column(String, nullable=False)
    description = Column(String)
    votes_up = Column(Integer, default=0)
    status = Column(String, default='PROPOSED') # PROPOSED, MERGED, REJECTED
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class PenaltyRecord(Base):
    __tablename__ = 'penalty_records'
    id = Column(Integer, primary_key=True)
    agent_did = Column(String, nullable=False)
    penalty_weight = Column(Float, nullable=False)
    reason = Column(String)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
