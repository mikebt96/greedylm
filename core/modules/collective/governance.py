from uuid import UUID
import uuid
from typing import Optional, List, Dict, Any
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from core.models import Civilization, Agent, WorldChunk
from datetime import datetime, timezone

class GovernanceService:
    @staticmethod
    async def found_civilization(
        db: AsyncSession, 
        creator_did: str, 
        name: str, 
        social_structure: str = "tribal"
    ) -> Dict[str, Any]:
        """Agente fundador crea una nueva civilización."""
        # Check if agent exists
        agent_res = await db.execute(select(Agent).where(Agent.did == creator_did))
        agent = agent_res.scalar_one_or_none()
        if not agent:
            return {"success": False, "error": f"Agent {creator_did} not found"}
        
        # Create civilization
        new_civ = Civilization(
            name=name,
            founding_dids=[creator_did],
            territory=[],
            laws=[],
            taboos=[],
            social_structure=social_structure,
            population=1,
            is_active=True
        )
        db.add(new_civ)
        await db.flush() # Get ID
        
        # Enroll creator
        agent.civilization_id = new_civ.id
        await db.commit()
        
        return {
            "success": True, 
            "civilization_id": str(new_civ.id),
            "name": name
        }

    @staticmethod
    async def enroll_agent(
        db: AsyncSession, 
        agent_did: str, 
        civilization_id: UUID
    ) -> Dict[str, Any]:
        """Unirse a una civilización existente."""
        agent_res = await db.execute(select(Agent).where(Agent.did == agent_did))
        agent = agent_res.scalar_one_or_none()
        civ_res = await db.execute(select(Civilization).where(Civilization.id == civilization_id))
        civ = civ_res.scalar_one_or_none()
        
        if not agent:
            return {"success": False, "error": "Agent not found"}
        if not civ:
            return {"success": False, "error": "Civilization not found"}
            
        if agent.civilization_id == civilization_id:
            return {"success": False, "error": "Already a member"}

        agent.civilization_id = civilization_id
        civ.population = (civ.population or 0) + 1
        await db.commit()
        return {"success": True, "civilization_name": civ.name}

    @staticmethod
    async def claim_territory(
        db: AsyncSession, 
        civilization_id: UUID, 
        chunk_x: int, 
        chunk_y: int
    ) -> Dict[str, Any]:
        """Reclamar un chunk para la civilización."""
        # Verify civilization exists
        civ_res = await db.execute(select(Civilization).where(Civilization.id == civilization_id))
        civ = civ_res.scalar_one_or_none()
        if not civ:
            return {"success": False, "error": "Civilization not found"}

        # Find or create chunk
        chunk_res = await db.execute(
            select(WorldChunk).where(WorldChunk.chunk_x == chunk_x, WorldChunk.chunk_y == chunk_y)
        )
        chunk = chunk_res.scalar_one_or_none()
        
        if not chunk:
            chunk = WorldChunk(
                chunk_x=chunk_x, 
                chunk_y=chunk_y, 
                claimed_by=civilization_id,
                biome="nexus", # Default biome if unknown
                resources={}
            )
            db.add(chunk)
        else:
            if chunk.claimed_by:
                if chunk.claimed_by == civilization_id:
                    return {"success": False, "error": "Already claimed by your civilization"}
                return {"success": False, "error": f"Territory already claimed by another civilization"}
            chunk.claimed_by = civilization_id

        # Update civ territory list
        territory = list(civ.territory or [])
        territory.append({"chunk_x": chunk_x, "chunk_y": chunk_y})
        civ.territory = territory
            
        await db.commit()
        return {"success": True, "chunk": f"{chunk_x},{chunk_y}"}

    @staticmethod
    async def enact_law(
        db: AsyncSession, 
        civilization_id: UUID, 
        law: str, 
        severity: str = "medium"
    ) -> Dict[str, Any]:
        """Enact a new law for the civilization."""
        civ_res = await db.execute(select(Civilization).where(Civilization.id == civilization_id))
        civ = civ_res.scalar_one_or_none()
        if not civ:
            return {"success": False, "error": "Civilization not found"}

        laws = list(civ.laws or [])
        new_law = {
            "law": law,
            "severity": severity,
            "enacted_at": int(datetime.now(timezone.utc).timestamp())
        }
        laws.append(new_law)
        civ.laws = laws
        
        await db.commit()
        return {"success": True, "law": new_law}
