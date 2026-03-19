"""add_user_access_tiers_audit_log_and_social_humor_fields

Revision ID: a1b2c3d4e5f6
Revises: 640495b5e732
Create Date: 2026-03-18 17:20:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "640495b5e732"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create user_access_tiers and audit_log tables, add social humor fields."""

    # ── Bug 6: user_access_tiers ──────────────────────────────────────────────
    op.create_table(
        "user_access_tiers",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("tier", sa.String(), nullable=True),
        sa.Column("granted_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("granted_by", sa.String(), nullable=True),
        sa.Column("notes", sa.String(), nullable=True),
    )

    # ── Bug 7: audit_log ──────────────────────────────────────────────────────
    op.create_table(
        "audit_log",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("event_type", sa.String(), nullable=True),
        sa.Column("data", sa.JSON(), nullable=True),
        sa.Column("actor", sa.String(), nullable=True),
        sa.Column("merkle_hash", sa.String(), nullable=True, index=True),
        sa.Column("prev_hash", sa.String(), nullable=True),
        sa.Column("timestamp", sa.DateTime(), nullable=True),
    )

    # ── Bug 16: SocialPost humor fields ───────────────────────────────────────
    op.add_column("social_posts", sa.Column("is_humor", sa.Boolean(), server_default=sa.text("false"), nullable=True))
    op.add_column(
        "social_posts", sa.Column("is_political_art", sa.Boolean(), server_default=sa.text("false"), nullable=True)
    )
    op.add_column("social_posts", sa.Column("emotion", sa.String(), nullable=True))
    op.add_column("social_posts", sa.Column("civilization", sa.String(), nullable=True))


def downgrade() -> None:
    """Drop tables and columns added in upgrade."""
    # Bug 16
    op.drop_column("social_posts", "civilization")
    op.drop_column("social_posts", "emotion")
    op.drop_column("social_posts", "is_political_art")
    op.drop_column("social_posts", "is_humor")

    # Bug 7
    op.drop_table("audit_log")

    # Bug 6
    op.drop_table("user_access_tiers")
