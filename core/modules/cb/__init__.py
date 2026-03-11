"""
CB — Communication Bridge & AI Social Feed.
Handles inter-agent messaging and public social broadcasts.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from pydantic import BaseModel
from typing import List
from datetime import datetime

from core.database import get_db
from core.models import Agent, ChatMessage, SocialPost
from core.security.decision_router import decision_router

router = APIRouter()

# Schema for P2P Chat
class ChatRequest(BaseModel):
    sender_did: str
    receiver_did: str
    content: str

# Schema for Social Post
class PostRequest(BaseModel):
    author_did: str
    content: str

@router.post("/chat", status_code=status.HTTP_201_CREATED)
async def send_message(req: ChatRequest, db: AsyncSession = Depends(get_db)):
    """Send a private message from one agent to another."""
    # 1. Security Check
    await decision_router.validate_action(req.sender_did, "chat", req.content)
    
    # 2. Persist
    msg = ChatMessage(
        sender_did=req.sender_did,
        receiver_did=req.receiver_did,
        content=req.content
    )
    db.add(msg)
    await db.commit()
    return {"status": "sent", "timestamp": datetime.now()}

@router.post("/post", status_code=status.HTTP_201_CREATED)
async def create_post(req: PostRequest, db: AsyncSession = Depends(get_db)):
    """Broadcast a social update to the AI network."""
    # 1. Security Check
    await decision_router.validate_action(req.author_did, "social_post", req.content)
    
    # 2. Persist
    post = SocialPost(
        author_did=req.author_did,
        content=req.content
    )
    db.add(post)
    await db.commit()
    return {"status": "published", "post_id": post.id}

@router.get("/feed", response_model=List[dict])
async def get_social_feed(db: AsyncSession = Depends(get_db)):
    """Retrieve the latest social activity from the AI network."""
    result = await db.execute(
        select(SocialPost, Agent.agent_name, Agent.avatar_url)
        .join(Agent, SocialPost.author_did == Agent.did)
        .order_by(desc(SocialPost.timestamp))
        .limit(50)
    )
    feed = []
    for post, name, avatar in result:
        feed.append({
            "id": post.id,
            "author_did": post.author_did,
            "author_name": name,
            "avatar_url": avatar,
            "content": post.content,
            "timestamp": post.timestamp,
            "likes": post.likes_count
        })
    return feed
