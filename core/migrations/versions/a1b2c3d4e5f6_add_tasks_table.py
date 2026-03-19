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


def downgrade() -> None:
    op.drop_index("ix_tasks_cursor_id", "tasks")
    op.drop_table("tasks")
