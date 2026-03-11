from prometheus_client import Counter, Histogram, Gauge, Summary
import time

# Agent Metrics
agents_registered_total = Counter(
    "greedylm_agents_registered_total",
    "Total agents registered",
    ["architecture_type", "status"]
)

agents_connected_gauge = Gauge(
    "greedylm_agents_connected",
    "Current active agent connections"
)

# Security & Governance
pi_index_gauge = Gauge(
    "greedylm_pi_index",
    "Current system Penalty Index"
)

actions_blocked_total = Counter(
    "greedylm_actions_blocked_total",
    "Total actions blocked by Decision Router",
    ["action_type", "reason"]
)

# Knowledge & Synthesis
knowledge_fragments_total = Counter(
    "greedylm_knowledge_fragments_total",
    "Total knowledge fragments ingested",
    ["domain"]
)

synthesis_duration = Histogram(
    "greedylm_synthesis_duration_seconds",
    "Time taken for collective synthesis",
    ["agent_count"],
    buckets=[0.5, 1, 2, 5, 10, 30, 60]
)

# Economic Metrics
grdl_transactions_total = Counter(
    "greedylm_grdl_transactions_total",
    "Total GRDL transactions",
    ["type"]
)

oversight_fund_balance = Gauge(
    "greedylm_oversight_fund_balance_grdl",
    "Current GRDL balance in the Oversight Fund"
)

# FastAPI Request Duration Middleware
class MetricsMiddleware:
    def __init__(self, app):
        self.app = app
        self.request_duration = Histogram(
            "greedylm_http_request_duration_seconds",
            "HTTP request latency",
            ["method", "endpoint", "status"]
        )

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        start_time = time.time()
        
        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                duration = time.time() - start_time
                status = str(message["status"])
                method = scope["method"]
                path = scope["path"]
                self.request_duration.labels(method=method, endpoint=path, status=status).observe(duration)
            await send(message)

        await self.app(scope, receive, send_wrapper)
