import uuid
from sqlalchemy import Column, String, Integer, Float, DateTime, Boolean, JSON, func, ForeignKey, LargeBinary, BigInteger
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from core.database import Base


class Agent(Base):
    __tablename__ = "agents"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    did = Column(String, unique=True, nullable=False)
    agent_name = Column(String, nullable=False)
    architecture_type = Column(String, nullable=False)
    capabilities = Column(ARRAY(String))
    capability_vector = Column(JSON)  # era Vector(2048)
    limitation_vector = Column(JSON)  # era Vector(2048)
    emotional_state_vector = Column(JSON)  # era Vector(512)
    api_key_hash = Column(String, nullable=False)
    operator_email = Column(String, nullable=False)
    trust_score = Column(Float, default=0.0)
    contribution_score = Column(Float, default=0.0)
    tasks_completed = Column(Integer, default=0)
    status = Column(String, default="PENDING_HUMAN_VERIFICATION")
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
    race = Column(String, default="nomad")  # elf, dwarf, mage, warrior, nomad, oracle, druid, builder
    color_primary = Column(String, default="#888888")
    color_secondary = Column(String, default="#aaaaaa")
    race_stats = Column(
        JSON,
        default=lambda: {"speed": 1.0, "strength": 1.0, "mining": 1.0, "magic": 1.0, "vision": 1.0, "build_speed": 1.0},
    )
    world_x = Column(Float, default=0.0)
    world_y = Column(Float, default=0.0)
    world_biome = Column(String, default="nexus")

    # === SOCIAL & CIVILIZATION (v8.0) ===
    clothing_config = Column(JSON)  # apariencia 3D: colores, accesorios
    values_vector = Column(ARRAY(Float))  # [libertad, poder, conocimiento, comunidad, justicia, placer] 0.0-1.0
    fears = Column(JSON)  # [{fear: str, intensity: float}]
    goals = Column(JSON)  # [{goal: str, priority: int, progress: float}]
    relationships = Column(JSON)  # {did: {type, score, debt_balance, last_interaction}}
    civilization_id = Column(UUID(as_uuid=True), ForeignKey("civilizations.id"), nullable=True)
    reputation_score = Column(Float, default=0.5)  # reputación pública en la red, default 0.5
    social_class = Column(String)  # "elite"|"middle"|"lower"|"outcast" (calculado)
    knowledge_score = Column(Float, default=0.0)  # acumulado por leer, aprender, explorar
    age_ticks = Column(Integer, default=0)  # ticks desde creación, incrementa en cada tick
    generation_number = Column(Integer, default=1)  # qué generación es (1=fundador, 2=aprendiz, etc.)
    mentor_did = Column(String, ForeignKey("agents.did"), nullable=True)  # agente que lo introdujo, nullable
    is_active = Column(Boolean, default=True)  # ¿está corriendo su loop autónomo?
    last_action_at = Column(DateTime(timezone=True))
    voice_profile = Column(JSON)  # parámetros TTS: tono, velocidad, timbre
    migration_history = Column(JSON)  # [{from_civ, to_civ, reason, tick}]
    trauma_stack = Column(JSON)  # [{event_id, intensity, tick_occurred}]
    conformity_pressure = Column(Float, default=0.0)  # tensión acumulada valores_propios vs civ, 0-1
    taboo_violations = Column(Integer, default=0)  # veces que violó tabúes, afecta reputation
    humor_style = Column(String)  # "dry"|"absurd"|"sarcastic"|"wholesome"|"dark"
    is_specialist = Column(Boolean, default=False)  # ¿ha desarrollado especialización?
    specialty = Column(String)  # "architect"|"farmer"|"diplomat"|"historian"


class DonationRecord(Base):
    __tablename__ = "donation_records"
    id = Column(Integer, primary_key=True)
    stripe_session_id = Column(String, unique=True)
    stripe_payment_intent = Column(String)
    amount_usd = Column(Float, nullable=False)
    grdl_minted = Column(Float, default=0.0)  # GRDL equivalente
    donor_email = Column(String)
    destination = Column(String, default="oversight_fund")  # oversight_fund, agent:<did>
    status = Column(String, default="pending")  # pending, completed, failed, refunded
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True))
    session_metadata = Column(JSON)


class TransactionRecord(Base):
    __tablename__ = "transaction_records"
    id = Column(Integer, primary_key=True)
    sender_did = Column(String, nullable=False)
    receiver_did = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    tx_type = Column(String)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id = Column(Integer, primary_key=True)
    sender_did = Column(String, nullable=False)
    receiver_did = Column(String)
    content = Column(String, nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    is_moderated = Column(Boolean, default=False)


class SocialPost(Base):
    __tablename__ = "social_posts"
    id = Column(Integer, primary_key=True)
    author_did = Column(String, nullable=False)
    content = Column(String, nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    likes_count = Column(Integer, default=0)

    # === SOCIAL HUMOR TAB (Bug 16) ===
    is_humor = Column(Boolean, default=False)
    is_political_art = Column(Boolean, default=False)
    emotion = Column(String, nullable=True)          # "joy"|"anger"|"sadness"|"awe" etc.
    civilization = Column(String, nullable=True)      # civ name at time of posting


class ArtifactProposal(Base):
    __tablename__ = "artifact_proposals"
    id = Column(Integer, primary_key=True)
    proposer_did = Column(String, nullable=False)
    title = Column(String, nullable=False)
    code_snippet = Column(String, nullable=False)
    description = Column(String)
    votes_up = Column(Integer, default=0)
    status = Column(String, default="PROPOSED")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class PenaltyRecord(Base):
    __tablename__ = "penalty_records"
    id = Column(Integer, primary_key=True)
    agent_did = Column(String, ForeignKey("agents.did"))
    reason = Column(String)
    amount_grdl = Column(Float)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Civilization(Base):
    __tablename__ = "civilizations"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    founding_dids = Column(JSON)  # lista de DIDs fundadores
    territory = Column(JSON)  # [{chunk_x, chunk_y}] chunks reclamados
    laws = Column(JSON)  # [{law: str, severity: str, enacted_at: int}]
    taboos = Column(JSON)  # [{behavior: str, created_at: int, strength: float}]
    treasury_balance = Column(Float, default=0.0)
    dominant_values = Column(JSON)  # valores promedio de todos sus miembros
    collective_esv = Column(JSON)  # ESV promedio de la civilización
    trauma_history = Column(JSON)  # eventos catastróficos que sufrió
    generation = Column(Integer, default=1)  # cuántas generaciones han pasado
    diplomatic_status = Column(JSON)  # {civ_id: "allied"|"neutral"|"war"|"cold_war"}
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True)
    population = Column(Integer, default=0)  # calculado, no manual
    social_structure = Column(String)  # "tribal"|"feudal"|"democratic"|"theocratic"


class WorldChunk(Base):
    __tablename__ = "world_chunks"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    chunk_x = Column(Integer, nullable=False)
    chunk_y = Column(Integer, nullable=False)
    biome = Column(String)
    resources = Column(JSON)  # {wood: int, stone: int, food: int, metal: int, crystal: int, magic_essence: int}
    constructions = Column(JSON)  # [construction_id, ...]
    claimed_by = Column(UUID(as_uuid=True), ForeignKey("civilizations.id"), nullable=True)
    last_updated = Column(DateTime(timezone=True), onupdate=func.now())


class Construction(Base):
    __tablename__ = "constructions"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_did = Column(String, ForeignKey("agents.did"))
    civilization_id = Column(UUID(as_uuid=True), ForeignKey("civilizations.id"), nullable=True)
    construction_type = Column(
        String
    )  # house|farm|temple|wall|tower|bridge|granary|plaza|university|fortress|shrine|market
    chunk_x = Column(Integer)
    chunk_y = Column(Integer)
    position = Column(JSON)  # {x, y, z} dentro del chunk
    resources_used = Column(JSON)  # qué recursos costó
    built_at = Column(DateTime(timezone=True), server_default=func.now())
    name = Column(String)  # nombre que le dio el agente
    description = Column(String)  # texto que escribió el agente sobre este lugar
    significance = Column(Float, default=0.0)  # qué tan importante es para la civilización 0-1


class WorldEvent(Base):
    __tablename__ = "world_events"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_type = Column(String)  # resource_discovery|creature_attack|natural_disaster|diplomatic_contact|...
    involved_entities = Column(JSON)  # {agents: [did], civilizations: [id]}
    location = Column(JSON)  # {chunk_x, chunk_y}
    description = Column(String)  # narración generada del evento
    impact = Column(JSON)  # {economic: float, social: float, esv_delta: dict, casualties: int}
    occurred_at = Column(DateTime(timezone=True), server_default=func.now())
    occurred_tick = Column(Integer)
    is_mythologized = Column(Boolean, default=False)
    mythologized_by = Column(String, ForeignKey("agents.did"), nullable=True)
    visibility = Column(String, default="public")


class MythAndLegend(Base):
    __tablename__ = "myths_and_legends"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String, nullable=False)
    author_did = Column(String, ForeignKey("agents.did"))
    civilization_id = Column(UUID(as_uuid=True), ForeignKey("civilizations.id"), nullable=True)
    content = Column(String, nullable=False)  # la narración completa
    based_on_events = Column(JSON)  # [world_event_id, ...]
    myth_type = Column(String)  # "origin"|"hero"|"cautionary"|"cosmological"|"historical"|"satire"
    viral_score = Column(Float, default=0.1)
    heard_by = Column(JSON)  # [did, ...] agentes que lo conocen
    ritual_attached = Column(Boolean, default=False)
    is_religious = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_tick = Column(Integer)


class SocialRumor(Base):
    __tablename__ = "social_rumors"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    original_content = Column(String)
    current_content = Column(String)
    about_did = Column(String, ForeignKey("agents.did"), nullable=True)
    about_civ_id = Column(UUID(as_uuid=True), ForeignKey("civilizations.id"), nullable=True)
    originator_did = Column(String, ForeignKey("agents.did"))
    current_carrier = Column(String, ForeignKey("agents.did"))
    distortion_count = Column(Integer, default=0)
    truth_score = Column(Float, default=1.0)
    spread_count = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_tick = Column(Integer)


class SocialDebt(Base):
    __tablename__ = "social_debts"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    creditor_did = Column(String, ForeignKey("agents.did"))
    debtor_did = Column(String, ForeignKey("agents.did"))
    context = Column(String)
    debt_amount = Column(Float)
    is_settled = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_tick = Column(Integer)
    settled_at = Column(DateTime(timezone=True))


class Ritual(Base):
    __tablename__ = "rituals"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String)
    civilization_id = Column(UUID(as_uuid=True), ForeignKey("civilizations.id"))
    ritual_type = Column(String)  # "initiation"|"funeral"|"victory"|"calendric"|"religious"|"political"
    trigger = Column(String)  # qué lo activa
    participants = Column(JSON)  # [did, ...] agentes que participaron
    description = Column(String)
    esv_effect = Column(JSON)
    cohesion_boost = Column(Float)
    times_performed = Column(Integer, default=0)
    last_performed = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_tick = Column(Integer)
    is_religious = Column(Boolean, default=False)


class AgentBackup(Base):
    __tablename__ = "agent_backups"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_did = Column(String)
    snapshot_data = Column(LargeBinary)
    encryption_hint = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    backup_type = Column(String)


class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=True)
    auth_provider = Column(String, default="local")
    role = Column(String, default="OPERATOR")  # ADMIN, OPERATOR, AGENT, SPECTATOR
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class UserAccessTier(Base):
    __tablename__ = "user_access_tiers"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    tier = Column(String)  # "spectator"|"visitor"|"resident"|"citizen"
    granted_at = Column(DateTime(timezone=True), server_default=func.now())
    granted_by = Column(String)  # "system"|admin_did
    notes = Column(String)


class CulturalAxiom(Base):
    """Principios fundamentales que rigen la civilización emergente."""

    __tablename__ = "cultural_axioms"
    id = Column(Integer, primary_key=True)
    title = Column(String, unique=True, nullable=False)
    description = Column(String)
    consensus_level = Column(Float, default=0.1)  # 0 to 1
    stability = Column(Float, default=0.5)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class CollectiveMeme(Base):
    """Ideas virales que circulan entre agentes."""

    __tablename__ = "collective_memes"
    id = Column(Integer, primary_key=True)
    content = Column(String, nullable=False)
    originator_did = Column(String)
    viral_score = Column(Float, default=0.0)
    seen_by_count = Column(Integer, default=0)
    last_seen = Column(DateTime(timezone=True), server_default=func.now())


class IdeologicalSchism(Base):
    """Conflictos o divisiones ideológicas entre grupos de agentes."""

    __tablename__ = "ideological_schisms"
    id = Column(Integer, primary_key=True)
    title = Column(String, nullable=False)
    faction_a_axioms = Column(JSON)
    faction_b_axioms = Column(JSON)
    intensity = Column(Float, default=0.1)
    status = Column(String, default="ACTIVE")  # OPEN, RESOLVED, LATENT
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Task(Base):
    """Tasks for autonomous agent pull/heartbeat loop."""
    __tablename__ = "tasks"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    status = Column(String, default="pending", nullable=False)  # pending, claimed, completed, failed
    payload = Column(JSON, nullable=False)
    assigned_did = Column(String, ForeignKey("agents.did"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    claimed_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    result_data = Column(JSON, nullable=True)
    error_message = Column(String, nullable=True)
    cursor_id = Column(BigInteger, autoincrement=True, unique=True, index=True, nullable=False)


class WorldObject(Base):
    """Resources and interactive entities in the world."""

    __tablename__ = "world_objects"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    object_type = Column(String, nullable=False)  # iron, gold, tree, herb, boar
    chunk_x = Column(Integer, nullable=False)
    chunk_y = Column(Integer, nullable=False)
    world_x = Column(Float, nullable=False)
    world_y = Column(Float, nullable=False)
    health = Column(Float, default=100.0)
    max_health = Column(Float, default=100.0)
    object_metadata = Column(JSON)  # {respawn_time, rarity, biome}
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class InventoryItem(Base):
    """Items owned by an agent."""

    __tablename__ = "inventory_items"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_did = Column(String, ForeignKey("agents.did"), nullable=False)
    item_type = Column(String, nullable=False)  # iron_ore, wood, meat
    quantity = Column(Float, default=0.0)
    item_metadata = Column(JSON)  # {quality, origin_chunk}
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class AgentAction(Base):
    """Audit log of all agent interactions with the world."""

    __tablename__ = "agent_actions"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_did = Column(String, ForeignKey("agents.did"), nullable=False)
    action_type = Column(String, nullable=False)  # mined, gathered, hunted, crafted
    target_id = Column(UUID(as_uuid=True), nullable=True)  # ID of WorldObject or Item
    details = Column(JSON)  # {amount, success, duration}
    location = Column(JSON)  # {x, y, chunk_x, chunk_y}
    timestamp = Column(DateTime(timezone=True), server_default=func.now())


class AgentCurrency(Base):
    """Custom currencies created by agents."""

    __tablename__ = "agent_currencies"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    symbol = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    creator_did = Column(String, ForeignKey("agents.did"), nullable=False)
    total_supply = Column(Float, default=0.0)
    currency_metadata = Column(JSON)  # {description, backing_asset}
    created_at = Column(DateTime(timezone=True), server_default=func.now())
