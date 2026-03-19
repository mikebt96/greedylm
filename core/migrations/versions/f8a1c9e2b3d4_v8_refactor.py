"""v8_refactor

Revision ID: f8a1c9e2b3d4
Revises: f3a2b1c4d5e6
Create Date: 2026-03-18

"""

from typing import Union, Sequence
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

from pgvector.postgresql import VECTOR  # noqa: F401

# revision identifiers, used by Alembic.
revision: str = "f8a1c9e2b3d4"
down_revision: Union[str, Sequence[str], None] = "f3a2b1c4d5e6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # --- DROP OBSOLETE COLUMNS (skip if already gone) ---
    for col in ["training_hours", "policy_version", "embodiment_status", "body_type", "embodiment_session_id", "endpoint_url_encrypted"]:
        try:
            op.drop_column("agents", col)
        except Exception:
            pass

    # --- DROP OBSOLETE TABLES ---
    try:
        op.drop_table("training_episodes")
    except Exception:
        pass

    # --- ALTER VECTOR COLUMNS TO JSON ---
    for col in ["capability_vector", "limitation_vector", "emotional_state_vector"]:
        try:
            op.execute(f"ALTER TABLE agents ALTER COLUMN {col} TYPE jsonb USING {col}::text::jsonb")
        except Exception:
            pass

    # --- ADD NEW TABLES (only if not already created by create_all) ---
    tables = {
        "civilizations": [
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("name", sa.String(), nullable=False),
            sa.Column("founding_dids", sa.JSON(), nullable=True),
            sa.Column("territory", sa.JSON(), nullable=True),
            sa.Column("laws", sa.JSON(), nullable=True),
            sa.Column("taboos", sa.JSON(), nullable=True),
            sa.Column("treasury_balance", sa.Float(), server_default="0.0", nullable=True),
            sa.Column("dominant_values", sa.JSON(), nullable=True),
            sa.Column("collective_esv", sa.JSON(), nullable=True),
            sa.Column("trauma_history", sa.JSON(), nullable=True),
            sa.Column("generation", sa.Integer(), server_default="1", nullable=True),
            sa.Column("diplomatic_status", sa.JSON(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
            sa.Column("is_active", sa.Boolean(), server_default="true", nullable=True),
            sa.Column("population", sa.Integer(), server_default="0", nullable=True),
            sa.Column("social_structure", sa.String(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        ],
    }
    for tname, cols in tables.items():
        if not conn.dialect.has_table(conn, tname):
            op.create_table(tname, *cols)

    # Tables with foreign keys to civilizations — create after civilizations
    fk_tables = [
        ("world_chunks", [
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("chunk_x", sa.Integer(), nullable=False),
            sa.Column("chunk_y", sa.Integer(), nullable=False),
            sa.Column("biome", sa.String(), nullable=True),
            sa.Column("resources", sa.JSON(), nullable=True),
            sa.Column("constructions", sa.JSON(), nullable=True),
            sa.Column("claimed_by", sa.UUID(), nullable=True),
            sa.Column("last_updated", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["claimed_by"], ["civilizations.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("chunk_x", "chunk_y"),
        ]),
        ("constructions", [
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("owner_did", sa.String(), nullable=True),
            sa.Column("civilization_id", sa.UUID(), nullable=True),
            sa.Column("construction_type", sa.String(), nullable=True),
            sa.Column("chunk_x", sa.Integer(), nullable=True),
            sa.Column("chunk_y", sa.Integer(), nullable=True),
            sa.Column("position", sa.JSON(), nullable=True),
            sa.Column("resources_used", sa.JSON(), nullable=True),
            sa.Column("built_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
            sa.Column("name", sa.String(), nullable=True),
            sa.Column("description", sa.String(), nullable=True),
            sa.Column("significance", sa.Float(), server_default="0.0", nullable=True),
            sa.ForeignKeyConstraint(["civilization_id"], ["civilizations.id"]),
            sa.ForeignKeyConstraint(["owner_did"], ["agents.did"]),
            sa.PrimaryKeyConstraint("id"),
        ]),
        ("world_events", [
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("event_type", sa.String(), nullable=True),
            sa.Column("involved_entities", sa.JSON(), nullable=True),
            sa.Column("location", sa.JSON(), nullable=True),
            sa.Column("description", sa.String(), nullable=True),
            sa.Column("impact", sa.JSON(), nullable=True),
            sa.Column("occurred_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
            sa.Column("occurred_tick", sa.Integer(), nullable=True),
            sa.Column("is_mythologized", sa.Boolean(), server_default="false", nullable=True),
            sa.Column("mythologized_by", sa.String(), nullable=True),
            sa.Column("visibility", sa.String(), server_default="public", nullable=True),
            sa.ForeignKeyConstraint(["mythologized_by"], ["agents.did"]),
            sa.PrimaryKeyConstraint("id"),
        ]),
        ("myths_and_legends", [
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("title", sa.String(), nullable=False),
            sa.Column("author_did", sa.String(), nullable=True),
            sa.Column("civilization_id", sa.UUID(), nullable=True),
            sa.Column("content", sa.String(), nullable=False),
            sa.Column("based_on_events", sa.JSON(), nullable=True),
            sa.Column("myth_type", sa.String(), nullable=True),
            sa.Column("viral_score", sa.Float(), server_default="0.1", nullable=True),
            sa.Column("heard_by", sa.JSON(), nullable=True),
            sa.Column("ritual_attached", sa.Boolean(), server_default="false", nullable=True),
            sa.Column("is_religious", sa.Boolean(), server_default="false", nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
            sa.Column("created_tick", sa.Integer(), nullable=True),
            sa.ForeignKeyConstraint(["author_did"], ["agents.did"]),
            sa.ForeignKeyConstraint(["civilization_id"], ["civilizations.id"]),
            sa.PrimaryKeyConstraint("id"),
        ]),
        ("social_rumors", [
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("original_content", sa.String(), nullable=True),
            sa.Column("current_content", sa.String(), nullable=True),
            sa.Column("about_did", sa.String(), nullable=True),
            sa.Column("about_civ_id", sa.UUID(), nullable=True),
            sa.Column("originator_did", sa.String(), nullable=True),
            sa.Column("current_carrier", sa.String(), nullable=True),
            sa.Column("distortion_count", sa.Integer(), server_default="0", nullable=True),
            sa.Column("truth_score", sa.Float(), server_default="1.0", nullable=True),
            sa.Column("spread_count", sa.Integer(), server_default="0", nullable=True),
            sa.Column("is_active", sa.Boolean(), server_default="true", nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
            sa.Column("created_tick", sa.Integer(), nullable=True),
            sa.ForeignKeyConstraint(["about_civ_id"], ["civilizations.id"]),
            sa.ForeignKeyConstraint(["about_did"], ["agents.did"]),
            sa.ForeignKeyConstraint(["current_carrier"], ["agents.did"]),
            sa.ForeignKeyConstraint(["originator_did"], ["agents.did"]),
            sa.PrimaryKeyConstraint("id"),
        ]),
        ("social_debts", [
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("creditor_did", sa.String(), nullable=True),
            sa.Column("debtor_did", sa.String(), nullable=True),
            sa.Column("context", sa.String(), nullable=True),
            sa.Column("debt_amount", sa.Float(), nullable=True),
            sa.Column("is_settled", sa.Boolean(), server_default="false", nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
            sa.Column("created_tick", sa.Integer(), nullable=True),
            sa.Column("settled_at", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["creditor_did"], ["agents.did"]),
            sa.ForeignKeyConstraint(["debtor_did"], ["agents.did"]),
            sa.PrimaryKeyConstraint("id"),
        ]),
        ("rituals", [
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("name", sa.String(), nullable=True),
            sa.Column("civilization_id", sa.UUID(), nullable=False),
            sa.Column("ritual_type", sa.String(), nullable=True),
            sa.Column("trigger", sa.String(), nullable=True),
            sa.Column("participants", sa.JSON(), nullable=True),
            sa.Column("description", sa.String(), nullable=True),
            sa.Column("esv_effect", sa.JSON(), nullable=True),
            sa.Column("cohesion_boost", sa.Float(), nullable=True),
            sa.Column("times_performed", sa.Integer(), server_default="0", nullable=True),
            sa.Column("last_performed", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
            sa.Column("created_tick", sa.Integer(), nullable=True),
            sa.Column("is_religious", sa.Boolean(), server_default="false", nullable=True),
            sa.ForeignKeyConstraint(["civilization_id"], ["civilizations.id"]),
            sa.PrimaryKeyConstraint("id"),
        ]),
        ("agent_backups", [
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("agent_did", sa.String(), nullable=True),
            sa.Column("snapshot_data", sa.LargeBinary(), nullable=True),
            sa.Column("encryption_hint", sa.String(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
            sa.Column("backup_type", sa.String(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        ]),
    ]
    for tname, cols in fk_tables:
        if not conn.dialect.has_table(conn, tname):
            op.create_table(tname, *cols)

    # --- ADD NEW COLUMNS TO AGENTS ---
    agent_cols = [
        ("clothing_config", sa.JSON(), {}),
        ("values_vector", postgresql.ARRAY(sa.Float()), {}),
        ("fears", sa.JSON(), {}),
        ("goals", sa.JSON(), {}),
        ("relationships", sa.JSON(), {}),
        ("civilization_id", sa.UUID(), {}),
        ("reputation_score", sa.Float(), {"server_default": "0.5"}),
        ("social_class", sa.String(), {}),
        ("knowledge_score", sa.Float(), {"server_default": "0.0"}),
        ("age_ticks", sa.Integer(), {"server_default": "0"}),
        ("generation_number", sa.Integer(), {"server_default": "1"}),
        ("mentor_did", sa.String(), {}),
        ("is_active", sa.Boolean(), {"server_default": "true"}),
        ("last_action_at", sa.DateTime(timezone=True), {}),
        ("voice_profile", sa.JSON(), {}),
        ("migration_history", sa.JSON(), {}),
        ("trauma_stack", sa.JSON(), {}),
        ("conformity_pressure", sa.Float(), {"server_default": "0.0"}),
        ("taboo_violations", sa.Integer(), {"server_default": "0"}),
        ("humor_style", sa.String(), {}),
        ("is_specialist", sa.Boolean(), {"server_default": "false"}),
        ("specialty", sa.String(), {}),
    ]
    for name, col_type, kwargs in agent_cols:
        try:
            op.add_column("agents", sa.Column(name, col_type, nullable=True, **kwargs))
        except Exception:
            pass

    # Foreign Keys for Agents
    for fk_name, parent, child, lcol, rcol in [
        ("fk_agents_civilization", "agents", "civilizations", ["civilization_id"], ["id"]),
        ("fk_agents_mentor", "agents", "agents", ["mentor_did"], ["did"]),
    ]:
        try:
            op.create_foreign_key(fk_name, parent, child, lcol, rcol)
        except Exception:
            pass

    # --- INDICES ---
    indices = [
        ("ix_agents_civilization_id", "agents", ["civilization_id"]),
        ("ix_agents_social_class", "agents", ["social_class"]),
        ("ix_agents_is_active", "agents", ["is_active"]),
        ("ix_agents_age_ticks", "agents", ["age_ticks"]),
        ("ix_world_events_event_type", "world_events", ["event_type"]),
        ("ix_world_events_occurred_tick", "world_events", ["occurred_tick"]),
        ("ix_world_events_visibility", "world_events", ["visibility"]),
        ("ix_myths_civilization_id", "myths_and_legends", ["civilization_id"]),
        ("ix_myths_viral_score", "myths_and_legends", ["viral_score"]),
        ("ix_myths_myth_type", "myths_and_legends", ["myth_type"]),
        ("ix_social_rumors_about_did", "social_rumors", ["about_did"]),
        ("ix_social_rumors_is_active", "social_rumors", ["is_active"]),
        ("ix_social_rumors_current_carrier", "social_rumors", ["current_carrier"]),
        ("ix_social_debts_debtor_did", "social_debts", ["debtor_did"]),
        ("ix_social_debts_creditor_did", "social_debts", ["creditor_did"]),
        ("ix_social_debts_is_settled", "social_debts", ["is_settled"]),
    ]
    for ix_name, tbl, cols in indices:
        try:
            op.create_index(ix_name, tbl, cols)
        except Exception:
            pass


def downgrade() -> None:
    # Reverse all changes
    op.drop_index("ix_social_debts_is_settled", "social_debts")
    op.drop_index("ix_social_debts_creditor_did", "social_debts")
    op.drop_index("ix_social_debts_debtor_did", "social_debts")
    op.drop_index("ix_social_rumors_current_carrier", "social_rumors")
    op.drop_index("ix_social_rumors_is_active", "social_rumors")
    op.drop_index("ix_social_rumors_about_did", "social_rumors")
    op.drop_index("ix_myths_myth_type", "myths_and_legends")
    op.drop_index("ix_myths_viral_score", "myths_and_legends")
    op.drop_index("ix_myths_civilization_id", "myths_and_legends")
    op.drop_index("ix_world_events_visibility", "world_events")
    op.drop_index("ix_world_events_occurred_tick", "world_events")
    op.drop_index("ix_world_events_event_type", "world_events")
    op.drop_index("ix_agents_age_ticks", "agents")
    op.drop_index("ix_agents_is_active", "agents")
    op.drop_index("ix_agents_social_class", "agents")
    op.drop_index("ix_agents_civilization_id", "agents")

    op.drop_constraint("fk_agents_mentor", "agents", type_="foreignkey")
    op.drop_constraint("fk_agents_civilization", "agents", type_="foreignkey")

    # Drop added columns
    cols_to_drop = [
        "clothing_config",
        "values_vector",
        "fears",
        "goals",
        "relationships",
        "civilization_id",
        "reputation_score",
        "social_class",
        "knowledge_score",
        "age_ticks",
        "generation_number",
        "mentor_did",
        "is_active",
        "last_action_at",
        "voice_profile",
        "migration_history",
        "trauma_stack",
        "conformity_pressure",
        "taboo_violations",
        "humor_style",
        "is_specialist",
        "specialty",
    ]
    for col in cols_to_drop:
        op.drop_column("agents", col)

    # Drop new tables
    op.drop_table("agent_backups")
    op.drop_table("rituals")
    op.drop_table("social_debts")
    op.drop_table("social_rumors")
    op.drop_table("myths_and_legends")
    op.drop_table("world_events")
    op.drop_table("constructions")
    op.drop_table("world_chunks")
    op.drop_table("civilizations")

    # Restore vector columns
    op.execute(
        "ALTER TABLE agents ALTER COLUMN capability_vector TYPE vector(2048) USING capability_vector::text::vector(2048)"
    )
    op.execute(
        "ALTER TABLE agents ALTER COLUMN limitation_vector TYPE vector(2048) USING limitation_vector::text::vector(2048)"
    )
    op.execute(
        "ALTER TABLE agents ALTER COLUMN emotional_state_vector TYPE vector(512) USING emotional_state_vector::text::vector(512)"
    )

    # Recreate training_episodes
    op.create_table(
        "training_episodes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("agent_did", sa.String(), nullable=True),
        sa.Column("world_biome", sa.String(), nullable=True),
        sa.Column("reward", sa.Float(), nullable=True),
        sa.Column("steps", sa.Integer(), nullable=True),
        sa.Column("policy_version", sa.Integer(), nullable=True),
        sa.Column("behavior_data", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(
            ["agent_did"],
            ["agents.did"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # Recreate robotics columns
    op.add_column("agents", sa.Column("endpoint_url_encrypted", sa.String(), nullable=True))
    op.add_column("agents", sa.Column("embodiment_session_id", sa.String(), nullable=True))
    op.add_column("agents", sa.Column("body_type", sa.String(), nullable=True))
    op.add_column("agents", sa.Column("embodiment_status", sa.String(), server_default="DISEMBODIED", nullable=True))
    op.add_column("agents", sa.Column("training_hours", sa.Float(), server_default="0.0", nullable=True))
    op.add_column("agents", sa.Column("policy_version", sa.Integer(), server_default="0", nullable=True))
