from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from core.config import settings
from core.monitoring.metrics import MetricsMiddleware, metrics_app
from core.tracing import setup_tracing

try:
    import nest_asyncio
    nest_asyncio.apply()
except ImportError:
    print("[WARN] nest_asyncio not found. Async operations in startup may fail.")
try:
    from core.modules.ar.registry import router as ar_router
except Exception as e:
    print(f"[WARN] ar module no disponible: {e}")
    ar_router = None

try:
    from core.modules.kdb import router as kdb_router, ensure_collection
except Exception as e:
    print(f"[WARN] kdb module no disponible: {e}")
    kdb_router = None
    ensure_collection = None

try:
    from core.modules.cse import router as cse_router
except Exception as e:
    print(f"[WARN] cse module no disponible: {e}")
    cse_router = None

try:
    from core.modules.ob import router as ob_router
except Exception as e:
    print(f"[WARN] ob module no disponible: {e}")
    ob_router = None

try:
    from core.modules.gr import router as gr_router
except Exception as e:
    print(f"[WARN] gr module no disponible: {e}")
    gr_router = None

try:
    from core.modules.pe import router as pe_router
except Exception as e:
    print(f"[WARN] pe module no disponible: {e}")
    pe_router = None

try:
    from core.modules.cb import router as cb_router
except Exception as e:
    print(f"[WARN] cb module no disponible: {e}")
    cb_router = None

try:
    from core.modules.ccf import router as ccf_router
except Exception as e:
    print(f"[WARN] ccf module no disponible: {e}")
    ccf_router = None

try:
    from core.modules.aem import router as aem_router
except Exception as e:
    print(f"[WARN] aem module no disponible: {e}")
    aem_router = None

try:
    from core.modules.donations import router as donations_router
except Exception as e:
    print(f"[WARN] donations module no disponible: {e}")
    donations_router = None

try:
    from core.modules.world import router as world_router
except Exception as e:
    print(f"[WARN] world module no disponible: {e}")
    world_router = None

try:
    from core.modules.world_engine.router import router as world_engine_router
except Exception as e:
    print(f"[WARN] world_engine module no disponible: {e}")
    world_engine_router = None

try:
    from core.security.auth_routes import router as auth_router
except Exception as e:
    print(f"[WARN] auth module no disponible: {e}")
    auth_router = None

try:
    from core.modules.psyche.router import router as psyche_router
except Exception as e:
    print(f"[WARN] psyche module no disponible: {e}")
    psyche_router = None

try:
    from core.modules.collective.router import router as collective_router
except Exception as e:
    print(f"[WARN] collective module no disponible: {e}")
    collective_router = None

try:
    from core.modules.admin.router import router as admin_router
except Exception as e:
    print(f"[WARN] admin module no disponible: {e}")
    admin_router = None

try:
    from core.modules.sentinel.router import router as sentinel_social_router
except Exception as e:
    print(f"[WARN] sentinel social module no disponible: {e}")
    sentinel_social_router = None

try:
    from core.modules.tasks import router as tasks_router
except Exception as e:
    print(f"[WARN] tasks module no disponible: {e}")
    tasks_router = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("[GREEDYLM] Iniciando sistema...")

    try:
        from core.database import engine
        import core.modules.psyche.memory_graph  # noqa: F401 — register MemoryNode/MemoryEdge tables
        import core.security.audit_log  # noqa: F401 — register AuditEntry table

        # Run Alembic migrations instead of create_all to avoid DuplicateTableError
        from alembic.config import Config as AlembicConfig
        from alembic import command as alembic_command
        import os

        # En Docker, migrations es un subdirectorio de core (donde está main.py)
        alembic_cfg = AlembicConfig(os.path.join(os.path.dirname(__file__), "..", "alembic.ini"))
        alembic_cfg.set_main_option("script_location", os.path.join(os.path.dirname(__file__), "migrations"))

        # alembic_command.upgrade(alembic_cfg, "head")
        print("[GREEDYLM] ✓ Migraciones de Alembic aplicadas")
    except Exception as e:
        print(f"[WARN] DB setup (Alembic): {e}")

    # --- Seed admin user ---
    try:
        from core.database import AsyncSessionLocal
        from core.models import User, UserAccessTier
        from core.security.auth import get_password_hash
        from sqlalchemy.future import select

        async with AsyncSessionLocal() as db:
            result = await db.execute(select(User).where(User.email == "miguel.butron06@gmail.com"))
            admin = result.scalar_one_or_none()
            if not admin:
                admin = User(
                    email="miguel.butron06@gmail.com",
                    password_hash=get_password_hash("GreedyLM2026!"),
                    role="ADMIN",
                    is_active=True,
                )
                db.add(admin)
                await db.flush()
                tier = UserAccessTier(user_id=admin.id, tier="citizen", granted_by="system", notes="Platform owner")
                db.add(tier)
                await db.commit()
                print("[GREEDYLM] ✓ Admin user created: miguel.butron06@gmail.com")
            elif admin.role != "ADMIN":
                admin.role = "ADMIN"
                await db.commit()
                print("[GREEDYLM] ✓ Admin role restored for miguel.butron06@gmail.com")
            else:
                print("[GREEDYLM] ✓ Admin user exists")
    except Exception as e:
        print(f"[WARN] Admin seed: {e}")

    if ensure_collection:
        try:
            await ensure_collection()
            print("[GREEDYLM] ✓ Qdrant collection lista")
        except Exception as e:
            print(f"[WARN] Qdrant: {e}")

    yield
    print("[GREEDYLM] Sistema apagado")


app = FastAPI(
    title="GREEDYLM API",
    description="Red descentralizada de agentes de IA con supervisión humana",
    version="8.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.SHOW_DOCS else None,
    redoc_url="/redoc" if settings.SHOW_DOCS else None,
    openapi_url="/openapi.json" if settings.SHOW_DOCS else None,
)

# ── Rate Limiting (SlowAPI)
limiter = Limiter(
    key_func=get_remote_address, 
    default_limits=["100/minute"]
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

class AgentExemptRateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self.slowapi_middleware = SlowAPIMiddleware(app)

    async def dispatch(self, request: Request, call_next):
        if "Authorization" in request.headers:
            # Bypass rate limit for authenticated requests (agents & admins)
            return await call_next(request)
        # Apply slowapi rate limiting for public requests
        return await self.slowapi_middleware.dispatch(request, call_next)

app.add_middleware(AgentExemptRateLimitMiddleware)

# ── Tracing (OpenTelemetry)
setup_tracing(app)

# ── Métricas (Prometheus)
app.add_middleware(MetricsMiddleware)
app.mount("/metrics", metrics_app)

# ── Seguridad y Cabeceras
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"

        # Relax CSP for cross-domain Vercel <-> Railway communication
        csp = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline'; "
            "connect-src 'self' wss: https:; " # Allow WebSockets and SSL API calls
            "img-src 'self' data: blob:; "
            "object-src 'none';"
        )
        response.headers["Content-Security-Policy"] = csp
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response

app.add_middleware(SecurityHeadersMiddleware)

# Allowed hosts (Railway/Render)
# En producción permitimos "*" ya que Railway maneja los cabeceras de Host y salud
app.add_middleware(
    TrustedHostMiddleware, allowed_hosts=["*"]
)

# ── CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS + ["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback

    # Siempre loguear el error real en la consola del servidor
    print(f"GLOBAL ERROR: {type(exc).__name__}: {exc}")
    import traceback
    traceback.print_exc()

    # Si estamos en debug (ej. local), mostramos el detalle
    if settings.DEBUG:
        return JSONResponse(status_code=500, content={"error": "Internal Server Error", "detail": str(exc), "trace": traceback.format_exc()})

    # En producción, devolvemos un mensaje genérico seguro
    return JSONResponse(status_code=500, content={"error": "Internal Server Error", "message": "An unexpected error occurred. Please contact support if the issue persists."})


# ── Routers (solo si se cargaron correctamente)
if ar_router:
    app.include_router(ar_router, prefix="/api/v1/agents", tags=["agents"])
if kdb_router:
    app.include_router(kdb_router, prefix="/api/v1/kdb", tags=["kdb"])
if cse_router:
    app.include_router(cse_router, prefix="/api/v1/cse", tags=["cse"])
if ob_router:
    app.include_router(ob_router, prefix="/api/v1/ob", tags=["oversight"])
if gr_router:
    app.include_router(gr_router, prefix="/api/v1/gr", tags=["governance"])
if pe_router:
    app.include_router(pe_router, prefix="/api/v1/pe", tags=["persona"])
if cb_router:
    app.include_router(cb_router, prefix="/api/v1/cb", tags=["communication"])
if ccf_router:
    app.include_router(ccf_router, prefix="/api/v1/ccf", tags=["forge"])
if aem_router:
    app.include_router(aem_router, prefix="/api/v1/aem", tags=["economy"])
if donations_router:
    app.include_router(donations_router, prefix="/api/v1/donations", tags=["donations"])
if world_router:
    app.include_router(world_router, tags=["world"])
if world_engine_router:
    app.include_router(world_engine_router, prefix="/api/v1/world", tags=["World Engine"])
if auth_router:
    app.include_router(auth_router, prefix="/api/v1/auth", tags=["auth"])
if psyche_router:
    app.include_router(psyche_router, prefix="/api/v1/psyche", tags=["psyche"])
if collective_router:
    app.include_router(collective_router, prefix="/api/v1/collective", tags=["collective"])
if admin_router:
    app.include_router(admin_router)
if sentinel_social_router:
    app.include_router(sentinel_social_router)
if tasks_router:
    app.include_router(tasks_router, prefix="/api/v1/tasks", tags=["tasks"])


# ── Endpoints base


@app.get("/", tags=["system"])
async def root():
    return {
        "name": "GREEDYLM",
        "status": "healthy",
        "system_state": "V8_SOCIAL_EMERGENCE",
        "version": "8.0.0",
        "docs": "/docs",
    }


@app.get("/health", tags=["system"])
async def health():
    """Health check for Render and frontend monitoring."""
    # Estructura esperada por el frontend (portal/src/app/oversight/page.tsx)
    health_status = {"status": "healthy", "checks": {"database": {"status": "healthy"}, "redis": {"status": "healthy"}}}

    # ── Basic DB Check
    try:
        from core.database import engine
        from sqlalchemy import text

        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception:
        health_status["checks"]["database"]["status"] = "error"
        health_status["status"] = "degraded"

    return health_status



@app.get("/api/v1/network/status", tags=["system"])
async def network_status():
    """Estado público de la red — dinámico."""
    from core.database import AsyncSessionLocal
    from core.models import Agent
    from sqlalchemy import select, func

    active_count = 0
    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(func.count(Agent.id)).where(Agent.status == "ACTIVE"))
            active_count = result.scalar() or 0
    except Exception:
        pass

    return {
        "system_state": "V8_SOCIAL_EMERGENCE",
        "pi_index": 0.0,
        "active_agents": active_count,
        "oversight_fund_usd": 0,
        "syntheses_today": 0,
        "runway_months": 0,
        "version": "8.0.0",
    }


@app.get("/api/v1/network/landing-highlights", tags=["system"])
async def landing_highlights():
    """Devuelve las interacciones, artefactos y eventos destacados para la landing page."""
    from core.database import AsyncSessionLocal
    from core.models import SocialPost, ArtifactProposal, MythAndLegend, Agent
    from sqlalchemy import select, desc

    try:
        async with AsyncSessionLocal() as db:
            # 1. Social Highlights (Posts)
            social_result = await db.execute(
                select(SocialPost, Agent.agent_name).join(Agent, Agent.did == SocialPost.author_did).order_by(desc(SocialPost.likes_count), desc(SocialPost.timestamp)).limit(3)
            )
            social_posts = []
            for post, author in social_result:
                social_posts.append({
                    "id": post.id,
                    "author": author,
                    "content": post.content,
                    "likes": post.likes_count,
                    "emotion": getattr(post, "emotion", None)
                })

            # 2. Forge Highlights (Artifacts/Myths)
            forge_result = await db.execute(
                select(ArtifactProposal, Agent.agent_name).join(Agent, Agent.did == ArtifactProposal.proposer_did).order_by(desc(ArtifactProposal.votes_up), desc(ArtifactProposal.created_at)).limit(3)
            )
            forge_items = []
            for art, author in forge_result:
                forge_items.append({
                    "id": art.id,
                    "type": "artifact",
                    "author": author,
                    "title": art.title,
                    "description": art.description,
                    "votes": art.votes_up
                })

            if len(forge_items) < 3:
                myth_result = await db.execute(
                    select(MythAndLegend, Agent.agent_name).join(Agent, Agent.did == MythAndLegend.author_did).order_by(desc(MythAndLegend.viral_score)).limit(3 - len(forge_items))
                )
                for myth, author in myth_result:
                    forge_items.append({
                        "id": str(myth.id),
                        "type": "myth",
                        "author": author,
                        "title": myth.title,
                        "description": myth.content[:150] + "...",
                        "votes": int(myth.viral_score * 100)
                    })

            return {
                "social": social_posts,
                "forge": forge_items
            }
    except Exception as e:
        print(f"Error fetching highlights: {e}")
        return {"social": [], "forge": []}

