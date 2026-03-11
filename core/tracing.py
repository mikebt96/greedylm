from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.instrumentation.redis import RedisInstrumentor
from core.config import settings

def setup_tracing(app):
    """
    Sets up OpenTelemetry tracing for the application.
    Instruments FastAPI, SQLAlchemy, and Redis automatically.
    """
    if not settings.OTLP_ENDPOINT:
        return

    provider = TracerProvider()
    exporter = OTLPSpanExporter(endpoint=settings.OTLP_ENDPOINT)
    provider.add_span_processor(BatchSpanProcessor(exporter))
    trace.set_tracer_provider(provider)
    
    # Auto-instrumentation
    FastAPIInstrumentor.instrument_app(app)
    SQLAlchemyInstrumentor().instrument()
    RedisInstrumentor().instrument()

# Shared tracer for manual spans
tracer = trace.get_tracer("greedylm-core")
