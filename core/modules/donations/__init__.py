from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
import stripe
from core.config import settings
from core.database import get_db
from core.models import DonationRecord
import datetime

router = APIRouter()
stripe.api_key = settings.STRIPE_SECRET_KEY

GRDL_RATE = 100  # 1 USD = 100 GRDL

class DonationRequest(BaseModel):
    amount_usd: float
    destination: str = "oversight_fund"
    donor_email: str | None = None

@router.post("/create-checkout")
async def create_checkout(req: DonationRequest, db: AsyncSession = Depends(get_db)):
    if req.amount_usd < 1:
        raise HTTPException(400, "Mínimo $1 USD")

    session = stripe.checkout.Session.create(
        payment_method_types=["card"],
        line_items=[{
            "price_data": {
                "currency": "usd",
                "unit_amount": int(req.amount_usd * 100),
                "product_data": {
                    "name": f"GREEDYLM Donation — {req.destination}",
                    "description": f"Supports AI agents. Earns {int(req.amount_usd * GRDL_RATE)} GRDL"
                }
            },
            "quantity": 1
        }],
        mode="payment",
        success_url=f"{settings.FRONTEND_URL}/donate?success=true&session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{settings.FRONTEND_URL}/donate?cancelled=true",
        customer_email=req.donor_email,
        metadata={
            "destination": req.destination,
            "grdl_amount": str(int(req.amount_usd * GRDL_RATE))
        }
    )

    # Registrar intent en BD
    record = DonationRecord(
        stripe_session_id=session.id,
        amount_usd=req.amount_usd,
        grdl_minted=req.amount_usd * GRDL_RATE,
        donor_email=req.donor_email,
        destination=req.destination,
        status="pending"
    )
    db.add(record)
    await db.commit()

    return {"checkout_url": session.url, "session_id": session.id}

@router.post("/webhook")
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except ValueError:
        raise HTTPException(400, "Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(400, "Invalid signature")

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        # Actualizar registro
        from sqlalchemy import select
        result = await db.execute(
            select(DonationRecord).where(DonationRecord.stripe_session_id == session["id"])
        )
        record = result.scalar_one_or_none()
        if record:
            record.status = "completed"
            record.stripe_payment_intent = session.get("payment_intent")
            record.completed_at = datetime.datetime.utcnow()
            await db.commit()

    return {"status": "ok"}

@router.get("/stats")
async def donation_stats(db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select, func as sqlfunc
    total = await db.execute(
        select(sqlfunc.sum(DonationRecord.amount_usd)).where(DonationRecord.status == "completed")
    )
    count = await db.execute(
        select(sqlfunc.count()).where(DonationRecord.status == "completed")
    )
    return {
        "total_usd": float(total.scalar() or 0),
        "total_donations": int(count.scalar() or 0),
        "grdl_in_vault": float((total.scalar() or 0) * GRDL_RATE)
    }
