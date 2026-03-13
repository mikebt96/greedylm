import time
from prometheus_client import (
    Counter, Histogram, Gauge,
    make_asgi_app, REGISTRY
)
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

# ── Métricas definidas una sola vez (evita duplicados en hot reload)
def _get_or_create_metric(metric_class, name, description, *args, **kwargs):
    try:
        return metric_class(name, description, *args, **kwargs)
    except ValueError:
        return REGISTRY._names_to_collectors.get(name)

http_requests_total = _get_or_create_metric(
    Counter,
    "greedylm_http_requests_total",
    "Total HTTP requests",
    ["method", "endpoint", "status"]
)

http_request_duration = _get_or_create_metric(
    Histogram,
    "greedylm_http_request_duration_seconds",
    "HTTP request duration",
    ["method", "endpoint"],
    buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0]
)

agents_connected = _get_or_create_metric(
    Gauge,
    "greedylm_agents_connected",
    "Agents connected via WebSocket"
)

pi_index = _get_or_create_metric(
    Gauge,
    "greedylm_pi_index",
    "Penalty Index current value"
)

# App ASGI para el endpoint /metrics
metrics_app = make_asgi_app()


class MetricsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # No medir el endpoint de métricas en sí mismo
        if request.url.path == "/metrics":
            return await call_next(request)

        start = time.time()
        response = await call_next(request)
        duration = time.time() - start

        # Normalizar path para evitar cardinalidad alta en Prometheus
        path = request.url.path
        for segment in path.split("/"):
            # Reemplazar UUIDs y DIDs por placeholder
            if len(segment) > 20 or segment.startswith("did:"):
                path = path.replace(segment, "{id}")
                break

        http_requests_total.labels(
            method=request.method,
            endpoint=path,
            status=response.status_code
        ).inc()

        http_request_duration.labels(
            method=request.method,
            endpoint=path,
        ).observe(duration)

        return response
