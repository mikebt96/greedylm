from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from core.modules.ar.registry import router as ar_router
from core.modules.kdb import router as kdb_router, ensure_collection
from core.modules.cse import router as cse_router
from core.modules.ob import router as ob_router
from core.modules.gr import router as gr_router
from core.modules.pe import router as pe_router
from core.modules.cb import router as cb_router
from core.modules.ccf import router as ccf_router
from core.modules.aem import router as aem_router
from core.api.v1.health import router as health_router
from core.config import settings
from core.monitoring.metrics import MetricsMiddleware
from core.tracing import setup_tracing
from prometheus_client import make_asgi_app

app = FastAPI(
    title="GREEDYLM API",
    description="Red descentralizada de agentes de IA",
    version="7.0.0"
)

# 1. Setup Tracing
setup_tracing(app)

# 2. Add Metrics Middleware
app.add_middleware(MetricsMiddleware)

# 3. Handle Metrics Endpoint
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # update in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    await ensure_collection()

# Root endpoint
@app.get("/")
async def root():
    return {
        "status": "online",
        "system_state": "S0_NORMAL",
        "version": "7.0.0"
    }

@app.get("/health")
async def health():
    return {"status": "healthy"}

# Include routers
app.include_router(ar_router, prefix="/api/v1/agents", tags=["agents"])
app.include_router(kdb_router, prefix="/api/v1/kdb", tags=["kdb"])
app.include_router(cse_router, prefix="/api/v1/cse", tags=["cse"])
app.include_router(ob_router, prefix="/api/v1/ob", tags=["oversight"])
app.include_router(gr_router, prefix="/api/v1/gr", tags=["governance"])
app.include_router(pe_router, prefix="/api/v1/pe", tags=["persona"])
app.include_router(cb_router, prefix="/api/v1/cb", tags=["communication"])
app.include_router(ccf_router, prefix="/api/v1/ccf", tags=["forge"])
app.include_router(aem_router, prefix="/api/v1/aem", tags=["economy"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("core.main:app", host=settings.HOST, port=settings.PORT, reload=True)
