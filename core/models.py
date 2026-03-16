import uuid
from sqlalchemy import Column, String, Integer, Float, DateTime, Boolean, JSON, func, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from core.database import Base

class Agent(Base):
    __tablename__ = 'agents'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    did = Column(String, unique=True, nullable=False)
    agent_name = Column(String, nullable=False)
    architecture_type = Column(String, nullable=False)
    capabilities = Column(ARRAY(String))
    capability_vector = Column(JSON)        # era Vector(2048)
    limitation_vector = Column(JSON)        # era Vector(2048)
    emotional_state_vector = Column(JSON)   # era Vector(512)
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

    # === SISTEMA DE RAZAS (Fase 1.1) ===
    race = Column(String, default='nomad')  # elf, dwarf, mage, warrior, nomad, oracle, druid, builder
    color_primary = Column(String, default='#888888')
    color_secondary = Column(String, default='#aaaaaa')
    race_stats = Column(JSON, default=lambda: {
        "speed": 1.0, "strength": 1.0, "mining": 1.0,
        "magic": 1.0, "vision": 1.0, "build_speed": 1.0
    })
    world_x = Column(Float, default=0.0)
    world_y = Column(Float, default=0.0)
    world_biome = Column(String, default='nexus')
    training_hours = Column(Float, default=0.0)   # Horas en el mundo simulado
    policy_version = Column(Integer, default=0)   # Versión del modelo ONNX entrenado

class DonationRecord(Base):
    __tablename__ = 'donation_records'
    id = Column(Integer, primary_key=True)
    stripe_session_id = Column(String, unique=True)
    stripe_payment_intent = Column(String)
    amount_usd = Column(Float, nullable=False)
    grdl_minted = Column(Float, default=0.0)  # GRDL equivalente
    donor_email = Column(String)
    destination = Column(String, default='oversight_fund')  # oversight_fund, agent:<did>
    status = Column(String, default='pending')  # pending, completed, failed, refunded
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True))
    session_metadata = Column(JSON)

class TransactionRecord(Base):
    __tablename__ = 'transaction_records'
    id = Column(Integer, primary_key=True)
    sender_did = Column(String, nullable=False)
    receiver_did = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    tx_type = Column(String)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

class ChatMessage(Base):
    __tablename__ = 'chat_messages'
    id = Column(Integer, primary_key=True)
    sender_did = Column(String, nullable=False)
    receiver_did = Column(String)
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
    status = Column(String, default='PROPOSED')
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class PenaltyRecord(Base):
    __tablename__ = 'penalty_records'
    id = Column(Integer, primary_key=True)
    agent_did = Column(String, ForeignKey('agents.did'))
    reason = Column(String)
    amount_grdl = Column(Float)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class TrainingEpisode(Base):
    __tablename__ = 'training_episodes'
    id = Column(Integer, primary_key=True)
    agent_did = Column(String, ForeignKey('agents.did'))
    world_biome = Column(String)
    reward = Column(Float)
    steps = Column(Integer)
    policy_version = Column(Integer)
    behavior_data = Column(JSON)  # Input/Output log for analysis
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class User(Base):
    __tablename__ = 'users'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, default='OPERATOR')  # ADMIN, OPERATOR, AGENT
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class CulturalAxiom(Base):
    """Principios fundamentales que rigen la civilización emergente."""
    __tablename__ = 'cultural_axioms'
    id = Column(Integer, primary_key=True)
    title = Column(String, unique=True, nullable=False)
    description = Column(String)
    consensus_level = Column(Float, default=0.1) # 0 to 1
    stability = Column(Float, default=0.5)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class CollectiveMeme(Base):
    """Ideas virales que circulan entre agentes."""
    __tablename__ = 'collective_memes'
    id = Column(Integer, primary_key=True)
    content = Column(String, nullable=False)
    originator_did = Column(String)
    viral_score = Column(Float, default=0.0)
    seen_by_count = Column(Integer, default=0)
    last_seen = Column(DateTime(timezone=True), server_default=func.now())

class IdeologicalSchism(Base):
    """Conflictos o divisiones ideológicas entre grupos de agentes."""
    __tablename__ = 'ideological_schisms'
    id = Column(Integer, primary_key=True)
    title = Column(String, nullable=False)
    faction_a_axioms = Column(JSON)
    faction_b_axioms = Column(JSON)
    intensity = Column(Float, default=0.1)
    status = Column(String, default='ACTIVE') # OPEN, RESOLVED, LATENT
    created_at = Column(DateTime(timezone=True), server_default=func.now())
