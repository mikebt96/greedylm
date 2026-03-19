"""
Tasks router — Pull/Heartbeat pattern for autonomous agents.
GET  /tasks              → list tasks with cursor pagination
POST /tasks/{id}/claim   → atomic claim with SELECT FOR UPDATE
POST /tasks/{id}/completions → submit result or failure
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import Optional
import uuid

from core.database import get_db
from core.models import Task
from core.security.auth_middleware import require_agent_token

router = APIRouter()


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class CompletionRequest(BaseModel):
    status: str  # "completed" | "failed"
    result_data: Optional[dict] = None
    error_message: Optional[str] = None


# ── GET /tasks ────────────────────────────────────────────────────────────────

@router.get("")
async def list_tasks(
    status: str = "pending",
    limit: int = 10,
    cursor: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(require_agent_token),
):
    """List tasks with cursor-based pagination (O(1), no OFFSET)."""
    if limit > 50:
        raise HTTPException(
            status_code=400,
            detail="Limit exceeds maximum of 50",
        )

    query = select(Task).where(Task.status == status)

    if cursor is not None:
        query = query.where(Task.cursor_id > cursor)

    query = query.order_by(Task.cursor_id.asc()).limit(limit + 1)

    result = await db.execute(query)
    rows = result.scalars().all()

    has_more = len(rows) > limit
    tasks_out = rows[:limit]

    return {
        "tasks": [
            {
                "id": str(t.id),
                "status": t.status,
                "payload": t.payload,
                "cursor_id": t.cursor_id,
                "created_at": t.created_at.isoformat() if t.created_at else None,
            }
            for t in tasks_out
        ],
        "has_more": has_more,
        "next_cursor": tasks_out[-1].cursor_id if has_more and tasks_out else None,
    }


# ── POST /tasks/{task_id}/claim ───────────────────────────────────────────────

@router.post("/{task_id}/claim")
async def claim_task(
    task_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(require_agent_token),
):
    """Atomically claim a pending task using SELECT FOR UPDATE."""
    agent_did = token.get("sub")

    # 1. Check existence first (outside lock)
    check = await db.execute(select(Task).where(Task.id == task_id))
    if not check.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Task not found")

    # 2. Atomic claim with row-level lock
    locked_query = (
        select(Task)
        .where(Task.id == task_id)
        .with_for_update()
    )
    result = await db.execute(locked_query)
    task = result.scalar_one()

    if task.status != "pending":
        raise HTTPException(
            status_code=409,
            detail="Task already claimed",
        )

    task.status = "claimed"
    task.assigned_did = agent_did
    task.claimed_at = func.now()

    await db.commit()
    await db.refresh(task)

    return {
        "id": str(task.id),
        "status": task.status,
        "payload": task.payload,
        "assigned_did": task.assigned_did,
        "cursor_id": task.cursor_id,
        "claimed_at": task.claimed_at.isoformat() if task.claimed_at else None,
        "created_at": task.created_at.isoformat() if task.created_at else None,
    }


# ── POST /tasks/{task_id}/completions ─────────────────────────────────────────

@router.post("/{task_id}/completions")
async def complete_task(
    task_id: uuid.UUID,
    body: CompletionRequest,
    db: AsyncSession = Depends(get_db),
    token: dict = Depends(require_agent_token),
):
    """Submit a completion (success or failure) for a claimed task."""
    agent_did = token.get("sub")

    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if task.status != "claimed":
        raise HTTPException(
            status_code=409,
            detail="Task is not in claimed state",
        )

    if task.assigned_did != agent_did:
        raise HTTPException(
            status_code=403,
            detail="Task was claimed by a different agent",
        )

    # Validate required fields based on completion status
    if body.status not in ("completed", "failed"):
        raise HTTPException(
            status_code=400,
            detail="status must be 'completed' or 'failed'",
        )

    if body.status == "completed" and body.result_data is None:
        raise HTTPException(
            status_code=400,
            detail="result_data is required for completed tasks",
        )

    if body.status == "failed" and body.error_message is None:
        raise HTTPException(
            status_code=400,
            detail="error_message is required for failed tasks",
        )

    task.status = body.status
    task.result_data = body.result_data
    task.error_message = body.error_message
    task.completed_at = func.now()

    await db.commit()
    await db.refresh(task)

    return {
        "id": str(task.id),
        "status": task.status,
        "payload": task.payload,
        "assigned_did": task.assigned_did,
        "cursor_id": task.cursor_id,
        "result_data": task.result_data,
        "error_message": task.error_message,
        "completed_at": task.completed_at.isoformat() if task.completed_at else None,
        "created_at": task.created_at.isoformat() if task.created_at else None,
        "claimed_at": task.claimed_at.isoformat() if task.claimed_at else None,
    }
