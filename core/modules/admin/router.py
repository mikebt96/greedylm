from fastapi import APIRouter, Depends, HTTPException, Body
from typing import Optional
from datetime import datetime
from core.security.auth import check_role
from core.modules.admin.kill_switch import kill_switch
from core.modules.admin.backup import backup_manager
from core.modules.admin.github_pr_manager import github_pr_manager
from core.database import AsyncSessionLocal
from core.models import Agent, WorldChunk, WorldEvent, SocialRumor, SocialDebt, Ritual, Civilization

router = APIRouter(prefix="/api/v1/admin", tags=["admin"], dependencies=[Depends(check_role(["ADMIN"]))])


@router.post("/kill-switch/token")
async def get_token():
    token = await kill_switch.generate_confirmation_token()
    return {"token": token}


@router.post("/kill-switch/agent/{did}")
async def disconnect_agent(did: str, body: dict = Body(...)):
    await kill_switch.disconnect_agent(did, body.get("reason", "Admin intervention"), body.get("save_backup", True))
    return {"status": "success"}


@router.post("/kill-switch/network")
async def disconnect_network(body: dict = Body(...)):
    mode = body.get("mode")
    token = body.get("confirmation_token")
    if mode not in ["PAUSE", "SNAPSHOT_RESET", "SOFT_RESET", "HARD_RESET", "ARCHIVE"]:
        raise HTTPException(status_code=400, detail="Invalid mode")
    try:
        await kill_switch.disconnect_all_agents(mode, token)
        return {"status": "success", "mode": mode}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/kill-switch/reactivate")
async def reactivate_network():
    await kill_switch.reactivate_network()
    return {"status": "success"}


@router.get("/backups")
async def list_backups(agent_did: Optional[str] = None):
    return await backup_manager.list_backups(agent_did)


@router.post("/backups/restore/{backup_id}")
async def restore_agent(backup_id: str, body: dict = Body(...)):
    master_key = body.get("master_key")
    success = await backup_manager.restore_agent(backup_id, master_key)
    if not success:
        raise HTTPException(status_code=400, detail="Restore failed or invalid key")
    return {"status": "success"}


@router.get("/github/prs")
async def list_prs():
    return await github_pr_manager.get_pending_prs()


@router.get("/github/prs/{pr_number}/diff")
async def get_diff(pr_number: int):
    return {"diff": await github_pr_manager.get_pr_diff(pr_number)}


@router.post("/github/prs/{pr_number}/approve")
async def approve_pr(pr_number: int, body: dict = Body(...)):
    await github_pr_manager.approve_pr(pr_number, body.get("admin_note", ""))
    return {"status": "approved"}


@router.get("/network/status")
async def get_network_status():
    async with AsyncSessionLocal() as db:
        from sqlalchemy import func, select

        active = (await db.execute(select(func.count(Agent.id)).where(Agent.is_active == True))).scalar()
        total = (await db.execute(select(func.count(Agent.id)))).scalar()
        rumors = (await db.execute(select(func.count(SocialRumor.id)).where(SocialRumor.is_active == True))).scalar()
        debts = (await db.execute(select(func.count(SocialDebt.id)).where(SocialDebt.is_settled == False))).scalar()

        return {
            "network_status": "ONLINE",  # In production check Redis
            "active_agents": active,
            "paused_agents": total - active,
            "active_rumors": rumors,
            "unsettled_debts": debts,
            "last_tick": datetime.utcnow(),
        }
