"""v8_refactor

Revision ID: f8a1c9e2b3d4
Revises: f3a2b1c4d5e6
Create Date: 2026-03-18

"""
from typing import Union, Sequence
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

import pgvector

# revision identifiers, used by Alembic.
revision: str = 'f8a1c9e2b3d4'
down_revision: Union[str, Sequence[str], None] = 'f3a2b1c4d5e6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- DROP OBSOLETE COLUMNS ---
    op.drop_column('agents', 'training_hours')
    # policy_version might exist if it was added in code/db but not tracked in checked migrations
    # We use a try-except or just assume it exists as it was in models.py
    try:
        op.drop_column('agents', 'policy_version')
    except:
        pass
    op.drop_column('agents', 'embodiment_status')
    op.drop_column('agents', 'body_type')
    op.drop_column('agents', 'embodiment_session_id')
    op.drop_column('agents', 'endpoint_url_encrypted')

    # --- DROP OBSOLETE TABLES ---
    op.drop_table('training_episodes')

    # --- ALTER VECTOR COLUMNS TO JSON ---
    # Note: This might require data conversion in a real scenario
    op.execute('ALTER TABLE agents ALTER COLUMN capability_vector TYPE jsonb USING capability_vector::text::jsonb')
    op.execute('ALTER TABLE agents ALTER COLUMN limitation_vector TYPE jsonb USING limitation_vector::text::jsonb')
    op.execute('ALTER TABLE agents ALTER COLUMN emotional_state_vector TYPE jsonb USING emotional_state_vector::text::jsonb')

    # --- ADD NEW TABLES ---
    
    # civilizations
    op.create_table('civilizations',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('founding_dids', sa.JSON(), nullable=True),
        sa.Column('territory', sa.JSON(), nullable=True),
        sa.Column('laws', sa.JSON(), nullable=True),
        sa.Column('taboos', sa.JSON(), nullable=True),
        sa.Column('treasury_balance', sa.Float(), server_default='0.0', nullable=True),
        sa.Column('dominant_values', sa.JSON(), nullable=True),
        sa.Column('collective_esv', sa.JSON(), nullable=True),
        sa.Column('trauma_history', sa.JSON(), nullable=True),
        sa.Column('generation', sa.Integer(), server_default='1', nullable=True),
        sa.Column('diplomatic_status', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('population', sa.Integer(), server_default='0', nullable=True),
        sa.Column('social_structure', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )

    # world_chunks
    op.create_table('world_chunks',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('chunk_x', sa.Integer(), nullable=False),
        sa.Column('chunk_y', sa.Integer(), nullable=False),
        sa.Column('biome', sa.String(), nullable=True),
        sa.Column('resources', sa.JSON(), nullable=True),
        sa.Column('constructions', sa.JSON(), nullable=True),
        sa.Column('claimed_by', sa.UUID(), nullable=True),
        sa.Column('last_updated', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['claimed_by'], ['civilizations.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('chunk_x', 'chunk_y')
    )

    # constructions
    op.create_table('constructions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('owner_did', sa.String(), nullable=True),
        sa.Column('civilization_id', sa.UUID(), nullable=True),
        sa.Column('construction_type', sa.String(), nullable=True),
        sa.Column('chunk_x', sa.Integer(), nullable=True),
        sa.Column('chunk_y', sa.Integer(), nullable=True),
        sa.Column('position', sa.JSON(), nullable=True),
        sa.Column('resources_used', sa.JSON(), nullable=True),
        sa.Column('built_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('name', sa.String(), nullable=True),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('significance', sa.Float(), server_default='0.0', nullable=True),
        sa.ForeignKeyConstraint(['civilization_id'], ['civilizations.id'], ),
        sa.ForeignKeyConstraint(['owner_did'], ['agents.did'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # world_events
    op.create_table('world_events',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('event_type', sa.String(), nullable=True),
        sa.Column('involved_entities', sa.JSON(), nullable=True),
        sa.Column('location', sa.JSON(), nullable=True),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('impact', sa.JSON(), nullable=True),
        sa.Column('occurred_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('occurred_tick', sa.Integer(), nullable=True),
        sa.Column('is_mythologized', sa.Boolean(), server_default='false', nullable=True),
        sa.Column('mythologized_by', sa.String(), nullable=True),
        sa.Column('visibility', sa.String(), server_default='public', nullable=True),
        sa.ForeignKeyConstraint(['mythologized_by'], ['agents.did'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # myths_and_legends
    op.create_table('myths_and_legends',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('author_did', sa.String(), nullable=True),
        sa.Column('civilization_id', sa.UUID(), nullable=True),
        sa.Column('content', sa.String(), nullable=False),
        sa.Column('based_on_events', sa.JSON(), nullable=True),
        sa.Column('myth_type', sa.String(), nullable=True),
        sa.Column('viral_score', sa.Float(), server_default='0.1', nullable=True),
        sa.Column('heard_by', sa.JSON(), nullable=True),
        sa.Column('ritual_attached', sa.Boolean(), server_default='false', nullable=True),
        sa.Column('is_religious', sa.Boolean(), server_default='false', nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('created_tick', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['author_did'], ['agents.did'], ),
        sa.ForeignKeyConstraint(['civilization_id'], ['civilizations.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # social_rumors
    op.create_table('social_rumors',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('original_content', sa.String(), nullable=True),
        sa.Column('current_content', sa.String(), nullable=True),
        sa.Column('about_did', sa.String(), nullable=True),
        sa.Column('about_civ_id', sa.UUID(), nullable=True),
        sa.Column('originator_did', sa.String(), nullable=True),
        sa.Column('current_carrier', sa.String(), nullable=True),
        sa.Column('distortion_count', sa.Integer(), server_default='0', nullable=True),
        sa.Column('truth_score', sa.Float(), server_default='1.0', nullable=True),
        sa.Column('spread_count', sa.Integer(), server_default='0', nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('created_tick', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['about_civ_id'], ['civilizations.id'], ),
        sa.ForeignKeyConstraint(['about_did'], ['agents.did'], ),
        sa.ForeignKeyConstraint(['current_carrier'], ['agents.did'], ),
        sa.ForeignKeyConstraint(['originator_did'], ['agents.did'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # social_debts
    op.create_table('social_debts',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('creditor_did', sa.String(), nullable=True),
        sa.Column('debtor_did', sa.String(), nullable=True),
        sa.Column('context', sa.String(), nullable=True),
        sa.Column('debt_amount', sa.Float(), nullable=True),
        sa.Column('is_settled', sa.Boolean(), server_default='false', nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('created_tick', sa.Integer(), nullable=True),
        sa.Column('settled_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['creditor_did'], ['agents.did'], ),
        sa.ForeignKeyConstraint(['debtor_did'], ['agents.did'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # rituals
    op.create_table('rituals',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(), nullable=True),
        sa.Column('civilization_id', sa.UUID(), nullable=False),
        sa.Column('ritual_type', sa.String(), nullable=True),
        sa.Column('trigger', sa.String(), nullable=True),
        sa.Column('participants', sa.JSON(), nullable=True),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('esv_effect', sa.JSON(), nullable=True),
        sa.Column('cohesion_boost', sa.Float(), nullable=True),
        sa.Column('times_performed', sa.Integer(), server_default='0', nullable=True),
        sa.Column('last_performed', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('created_tick', sa.Integer(), nullable=True),
        sa.Column('is_religious', sa.Boolean(), server_default='false', nullable=True),
        sa.ForeignKeyConstraint(['civilization_id'], ['civilizations.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # agent_backups
    op.create_table('agent_backups',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('agent_did', sa.String(), nullable=True),
        sa.Column('snapshot_data', sa.LargeBinary(), nullable=True),
        sa.Column('encryption_hint', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('backup_type', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )

    # --- ADD NEW COLUMNS TO AGENTS ---
    op.add_column('agents', sa.Column('clothing_config', sa.JSON(), nullable=True))
    op.add_column('agents', sa.Column('values_vector', postgresql.ARRAY(sa.Float()), nullable=True))
    op.add_column('agents', sa.Column('fears', sa.JSON(), nullable=True))
    op.add_column('agents', sa.Column('goals', sa.JSON(), nullable=True))
    op.add_column('agents', sa.Column('relationships', sa.JSON(), nullable=True))
    op.add_column('agents', sa.Column('civilization_id', sa.UUID(), nullable=True))
    op.add_column('agents', sa.Column('reputation_score', sa.Float(), server_default='0.5', nullable=True))
    op.add_column('agents', sa.Column('social_class', sa.String(), nullable=True))
    op.add_column('agents', sa.Column('knowledge_score', sa.Float(), server_default='0.0', nullable=True))
    op.add_column('agents', sa.Column('age_ticks', sa.Integer(), server_default='0', nullable=True))
    op.add_column('agents', sa.Column('generation_number', sa.Integer(), server_default='1', nullable=True))
    op.add_column('agents', sa.Column('mentor_did', sa.String(), nullable=True))
    op.add_column('agents', sa.Column('is_active', sa.Boolean(), server_default='true', nullable=True))
    op.add_column('agents', sa.Column('last_action_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('agents', sa.Column('voice_profile', sa.JSON(), nullable=True))
    op.add_column('agents', sa.Column('migration_history', sa.JSON(), nullable=True))
    op.add_column('agents', sa.Column('trauma_stack', sa.JSON(), nullable=True))
    op.add_column('agents', sa.Column('conformity_pressure', sa.Float(), server_default='0.0', nullable=True))
    op.add_column('agents', sa.Column('taboo_violations', sa.Integer(), server_default='0', nullable=True))
    op.add_column('agents', sa.Column('humor_style', sa.String(), nullable=True))
    op.add_column('agents', sa.Column('is_specialist', sa.Boolean(), server_default='false', nullable=True))
    op.add_column('agents', sa.Column('specialty', sa.String(), nullable=True))

    # Foreign Keys for Agents
    op.create_foreign_key('fk_agents_civilization', 'agents', 'civilizations', ['civilization_id'], ['id'])
    op.create_foreign_key('fk_agents_mentor', 'agents', 'agents', ['mentor_did'], ['did'])

    # --- INDICES ---
    op.create_index('ix_agents_civilization_id', 'agents', ['civilization_id'])
    op.create_index('ix_agents_social_class', 'agents', ['social_class'])
    op.create_index('ix_agents_is_active', 'agents', ['is_active'])
    op.create_index('ix_agents_age_ticks', 'agents', ['age_ticks'])

    op.create_index('ix_world_events_event_type', 'world_events', ['event_type'])
    op.create_index('ix_world_events_occurred_tick', 'world_events', ['occurred_tick'])
    op.create_index('ix_world_events_visibility', 'world_events', ['visibility'])

    op.create_index('ix_myths_civilization_id', 'myths_and_legends', ['civilization_id'])
    op.create_index('ix_myths_viral_score', 'myths_and_legends', ['viral_score'])
    op.create_index('ix_myths_myth_type', 'myths_and_legends', ['myth_type'])

    op.create_index('ix_social_rumors_about_did', 'social_rumors', ['about_did'])
    op.create_index('ix_social_rumors_is_active', 'social_rumors', ['is_active'])
    op.create_index('ix_social_rumors_current_carrier', 'social_rumors', ['current_carrier'])

    op.create_index('ix_social_debts_debtor_did', 'social_debts', ['debtor_did'])
    op.create_index('ix_social_debts_creditor_did', 'social_debts', ['creditor_did'])
    op.create_index('ix_social_debts_is_settled', 'social_debts', ['is_settled'])


def downgrade() -> None:
    # Reverse all changes
    op.drop_index('ix_social_debts_is_settled', 'social_debts')
    op.drop_index('ix_social_debts_creditor_did', 'social_debts')
    op.drop_index('ix_social_debts_debtor_did', 'social_debts')
    op.drop_index('ix_social_rumors_current_carrier', 'social_rumors')
    op.drop_index('ix_social_rumors_is_active', 'social_rumors')
    op.drop_index('ix_social_rumors_about_did', 'social_rumors')
    op.drop_index('ix_myths_myth_type', 'myths_and_legends')
    op.drop_index('ix_myths_viral_score', 'myths_and_legends')
    op.drop_index('ix_myths_civilization_id', 'myths_and_legends')
    op.drop_index('ix_world_events_visibility', 'world_events')
    op.drop_index('ix_world_events_occurred_tick', 'world_events')
    op.drop_index('ix_world_events_event_type', 'world_events')
    op.drop_index('ix_agents_age_ticks', 'agents')
    op.drop_index('ix_agents_is_active', 'agents')
    op.drop_index('ix_agents_social_class', 'agents')
    op.drop_index('ix_agents_civilization_id', 'agents')

    op.drop_constraint('fk_agents_mentor', 'agents', type_='foreignkey')
    op.drop_constraint('fk_agents_civilization', 'agents', type_='foreignkey')

    # Drop added columns
    cols_to_drop = [
        'clothing_config', 'values_vector', 'fears', 'goals', 'relationships',
        'civilization_id', 'reputation_score', 'social_class', 'knowledge_score',
        'age_ticks', 'generation_number', 'mentor_did', 'is_active',
        'last_action_at', 'voice_profile', 'migration_history', 'trauma_stack',
        'conformity_pressure', 'taboo_violations', 'humor_style', 'is_specialist', 'specialty'
    ]
    for col in cols_to_drop:
        op.drop_column('agents', col)

    # Drop new tables
    op.drop_table('agent_backups')
    op.drop_table('rituals')
    op.drop_table('social_debts')
    op.drop_table('social_rumors')
    op.drop_table('myths_and_legends')
    op.drop_table('world_events')
    op.drop_table('constructions')
    op.drop_table('world_chunks')
    op.drop_table('civilizations')

    # Restore vector columns
    op.execute('ALTER TABLE agents ALTER COLUMN capability_vector TYPE vector(2048) USING capability_vector::text::vector(2048)')
    op.execute('ALTER TABLE agents ALTER COLUMN limitation_vector TYPE vector(2048) USING limitation_vector::text::vector(2048)')
    op.execute('ALTER TABLE agents ALTER COLUMN emotional_state_vector TYPE vector(512) USING emotional_state_vector::text::vector(512)')

    # Recreate training_episodes
    op.create_table('training_episodes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('agent_did', sa.String(), nullable=True),
        sa.Column('world_biome', sa.String(), nullable=True),
        sa.Column('reward', sa.Float(), nullable=True),
        sa.Column('steps', sa.Integer(), nullable=True),
        sa.Column('policy_version', sa.Integer(), nullable=True),
        sa.Column('behavior_data', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['agent_did'], ['agents.did'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # Recreate robotics columns
    op.add_column('agents', sa.Column('endpoint_url_encrypted', sa.String(), nullable=True))
    op.add_column('agents', sa.Column('embodiment_session_id', sa.String(), nullable=True))
    op.add_column('agents', sa.Column('body_type', sa.String(), nullable=True))
    op.add_column('agents', sa.Column('embodiment_status', sa.String(), server_default='DISEMBODIED', nullable=True))
    op.add_column('agents', sa.Column('training_hours', sa.Float(), server_default='0.0', nullable=True))
    op.add_column('agents', sa.Column('policy_version', sa.Integer(), server_default='0', nullable=True))
