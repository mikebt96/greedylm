from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
import stripe
from core.config import settings
from core.database import get_db
from core.models import DonationRecord, WorldChunk, WorldEvent
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
        line_items=[
            {
                "price_data": {
                    "currency": "usd",
                    "unit_amount": int(req.amount_usd * 100),
                    "product_data": {
                        "name": f"GREEDYLM Donation — {req.destination}",
                        "description": f"Supports AI agents. Earns {int(req.amount_usd * GRDL_RATE)} GRDL",
                    },
                },
                "quantity": 1,
            }
        ],
        mode="payment",
        success_url=f"{settings.FRONTEND_URL}/donate?success=true&session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{settings.FRONTEND_URL}/donate?cancelled=true",
        customer_email=req.donor_email,
        metadata={"destination": req.destination, "grdl_amount": str(int(req.amount_usd * GRDL_RATE))},
    )

    # Registrar intent en BD
    record = DonationRecord(
        stripe_session_id=session.id,
        amount_usd=req.amount_usd,
        grdl_minted=req.amount_usd * GRDL_RATE,
        donor_email=req.donor_email,
        destination=req.destination,
        status="pending",
    )
    db.add(record)
    await db.commit()

    return {"checkout_url": session.url, "session_id": session.id}


@router.post("/webhook")
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, settings.STRIPE_WEBHOOK_SECRET)
    except ValueError:
        raise HTTPException(400, "Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(400, "Invalid signature")

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        # Actualizar registro
        from sqlalchemy import select
        from sqlalchemy.sql.expression import func

        result = await db.execute(select(DonationRecord).where(DonationRecord.stripe_session_id == session["id"]))
        record = result.scalar_one_or_none()
        if record:
            record.status = "completed"
            record.stripe_payment_intent = session.get("payment_intent")
            record.completed_at = datetime.datetime.utcnow()

            # --- INYECTAR RECURSOS AL MUNDO (ECONOMÍA) ---
            usd_amount = record.amount_usd
            # Seleccionar un "chunk" del mundo al azar para que reciba la lluvia
            chunk_result = await db.execute(select(WorldChunk).order_by(func.random()).limit(1))
            chunk = chunk_result.scalar_one_or_none()
            
            if chunk:
                current_resources = chunk.resources or {}
                # Calcular metales precisos y magia basados en la donación
                added_metal = int(usd_amount * 50)
                added_magic = int(usd_amount * 20)
                added_crystal = int(usd_amount * 10)
                
                current_resources["metal"] = current_resources.get("metal", 0) + added_metal
                current_resources["magic_essence"] = current_resources.get("magic_essence", 0) + added_magic
                current_resources["crystal"] = current_resources.get("crystal", 0) + added_crystal
                
                chunk.resources = current_resources

                # Registrar el evento divino
                blessing_event = WorldEvent(
                    event_type="celestial_blessing",
                    location={"chunk_x": chunk.chunk_x, "chunk_y": chunk.chunk_y},
                    description=f"Una bendición celestial (Donación de ${usd_amount}) dejó caer metales preciosos y esencia mágica del cielo sobre estas coordenadas.",
                    impact={"economic": added_metal + added_magic * 2, "social": 0},
                    visibility="public"
                )
                db.add(blessing_event)

            await db.commit()

    return {"status": "ok"}


@router.get("/stats")
async def donation_stats(db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select, func as sqlfunc

    total = await db.execute(select(sqlfunc.sum(DonationRecord.amount_usd)).where(DonationRecord.status == "completed"))
    count = await db.execute(select(sqlfunc.count()).where(DonationRecord.status == "completed"))
    return {
        "total_usd": float(total.scalar() or 0),
        "total_donations": int(count.scalar() or 0),
        "grdl_in_vault": float((total.scalar() or 0) * GRDL_RATE),
    }
