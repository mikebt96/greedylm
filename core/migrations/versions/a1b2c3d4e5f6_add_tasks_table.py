"""add_tasks_table

Revision ID: a1b2c3d4e5f6
Revises: f8a1c9e2b3d4
Create Date: 2026-03-19

"""

from typing import Union, Sequence
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "f8a1c9e2b3d4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    if not conn.dialect.has_table(conn, "tasks"):
        op.create_table(
            "tasks",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("status", sa.String(), server_default="pending", nullable=False),
            sa.Column("payload", sa.JSON(), nullable=False),
            sa.Column("assigned_did", sa.String(), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.Column("claimed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("result_data", sa.JSON(), nullable=True),
            sa.Column("error_message", sa.String(), nullable=True),
            sa.Column(
                "cursor_id",
                sa.BigInteger(),
                autoincrement=True,
                nullable=False,
            ),
            sa.PrimaryKeyConstraint("id"),
            sa.ForeignKeyConstraint(["assigned_did"], ["agents.did"]),
            sa.UniqueConstraint("cursor_id"),
        )
        op.create_index("ix_tasks_cursor_id", "tasks", ["cursor_id"])
    if not conn.dialect.has_table(conn, "donation_records"):
        op.create_table(
            "donation_records",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("stripe_session_id", sa.String(), nullable=True),
            sa.Column("stripe_payment_intent", sa.String(), nullable=True),
            sa.Column("amount_usd", sa.Float(), nullable=False),
            sa.Column("grdl_minted", sa.Float(), nullable=True),
            sa.Column("donor_email", sa.String(), nullable=True),
            sa.Column("destination", sa.String(), nullable=True),
            sa.Column("status", sa.String(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
            sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("session_metadata", sa.JSON(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("stripe_session_id"),
        )

    if not conn.dialect.has_table(conn, "transaction_records"):
        op.create_table(
            "transaction_records",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("sender_did", sa.String(), nullable=False),
            sa.Column("receiver_did", sa.String(), nullable=False),
            sa.Column("amount", sa.Float(), nullable=False),
            sa.Column("tx_type", sa.String(), nullable=True),
            sa.Column("timestamp", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )

    if not conn.dialect.has_table(conn, "chat_messages"):
        op.create_table(
            "chat_messages",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("sender_did", sa.String(), nullable=False),
            sa.Column("receiver_did", sa.String(), nullable=True),
            sa.Column("content", sa.String(), nullable=False),
            sa.Column("timestamp", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
            sa.Column("is_moderated", sa.Boolean(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )

    if not conn.dialect.has_table(conn, "social_posts"):
        op.create_table(
            "social_posts",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("author_did", sa.String(), nullable=False),
            sa.Column("content", sa.String(), nullable=False),
            sa.Column("timestamp", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
            sa.Column("likes_count", sa.Integer(), nullable=True),
            sa.Column("is_humor", sa.Boolean(), nullable=True),
            sa.Column("is_political_art", sa.Boolean(), nullable=True),
            sa.Column("emotion", sa.String(), nullable=True),
            sa.Column("civilization", sa.String(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )

    if not conn.dialect.has_table(conn, "artifact_proposals"):
        op.create_table(
            "artifact_proposals",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("proposer_did", sa.String(), nullable=False),
            sa.Column("title", sa.String(), nullable=False),
            sa.Column("code_snippet", sa.String(), nullable=False),
            sa.Column("description", sa.String(), nullable=True),
            sa.Column("votes_up", sa.Integer(), nullable=True),
            sa.Column("status", sa.String(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )

    if not conn.dialect.has_table(conn, "user_access_tiers"):
        op.create_table(
            "user_access_tiers",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("user_id", sa.UUID(), nullable=False),
            sa.Column("tier", sa.String(), nullable=True),
            sa.Column("granted_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
            sa.Column("granted_by", sa.String(), nullable=True),
            sa.Column("notes", sa.String(), nullable=True),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
        )


def downgrade() -> None:
    op.drop_index("ix_tasks_cursor_id", "tasks")
    op.drop_table("tasks")
