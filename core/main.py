from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager

from core.config import settings
from core.monitoring.metrics import MetricsMiddleware, metrics_app
from core.tracing import setup_tracing

# Importar routers — cada uno con fallback si falla
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


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("[GREEDYLM] Iniciando sistema...")

    try:
        from core.database import engine, Base
        async with engine.begin() as conn:
            # Recrear tablas (drop_all comentado para evitar pérdida de datos en prod)
            # await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)
        print("[GREEDYLM] ✓ Persistencia de datos activa en PostgreSQL")
    except Exception as e:
        print(f"[WARN] DB setup: {e}")

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
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── Tracing (OpenTelemetry)
setup_tracing(app)

# ── Métricas (Prometheus)
app.add_middleware(MetricsMiddleware)
app.mount("/metrics", metrics_app)

# ── CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    print(f"GLOBAL ERROR: {exc}")
    import traceback
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal Server Error",
            "detail": str(exc)
        }
    )

# ── Routers (solo si se cargaron correctamente)
if ar_router:
    app.include_router(ar_router,  prefix="/api/v1/agents", tags=["agents"])
if kdb_router:
    app.include_router(kdb_router, prefix="/api/v1/kdb",    tags=["kdb"])
if cse_router:
    app.include_router(cse_router, prefix="/api/v1/cse",    tags=["cse"])
if ob_router:
    app.include_router(ob_router,  prefix="/api/v1/ob",     tags=["oversight"])
if gr_router:
    app.include_router(gr_router,  prefix="/api/v1/gr",     tags=["governance"])
if pe_router:
    app.include_router(pe_router,  prefix="/api/v1/pe",     tags=["persona"])
if cb_router:
    app.include_router(cb_router,  prefix="/api/v1/cb",     tags=["communication"])
if ccf_router:
    app.include_router(ccf_router, prefix="/api/v1/ccf",    tags=["forge"])
if aem_router:
    app.include_router(aem_router, prefix="/api/v1/aem",    tags=["economy"])
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
    health_status = {
        "status": "healthy",
        "checks": {
            "database": {"status": "healthy"},
            "redis": {"status": "healthy"}
        }
    }

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
