"""add world and race fields to agents

Revision ID: f3a2b1c4d5e6
Revises: ae101d2361dd
Create Date: 2026-03-17

"""
from typing import Union, Sequence
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'f3a2b1c4d5e6'
down_revision: Union[str, Sequence[str], None] = 'ae101d2361dd'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('agents', sa.Column('race', sa.String(), nullable=True))
    op.add_column('agents', sa.Column('color_primary', sa.String(), nullable=True))
    op.add_column('agents', sa.Column('color_secondary', sa.String(), nullable=True))
    op.add_column('agents', sa.Column('race_stats', sa.JSON(), nullable=True))
    op.add_column('agents', sa.Column('world_x', sa.Float(), nullable=True))
    op.add_column('agents', sa.Column('world_y', sa.Float(), nullable=True))
    op.add_column('agents', sa.Column('world_biome', sa.String(), nullable=True))
    op.add_column('agents', sa.Column('training_hours', sa.Float(), nullable=True, server_default='0.0'))


def downgrade() -> None:
    op.drop_column('agents', 'training_hours')
    op.drop_column('agents', 'world_biome')
    op.drop_column('agents', 'world_y')
    op.drop_column('agents', 'world_x')
    op.drop_column('agents', 'race_stats')
    op.drop_column('agents', 'color_secondary')
    op.drop_column('agents', 'color_primary')
    op.drop_column('agents', 'race')
