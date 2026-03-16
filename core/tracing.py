from fastapi import FastAPI

def setup_tracing(app: FastAPI) -> None:
    """
    Configura OpenTelemetry si está disponible.
    Si no está instalado, no hace nada (fail-safe).
    Esto permite que el sistema arranque en cualquier entorno
    sin requerir el stack completo de observabilidad.
    """
    try:
        from opentelemetry import trace
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

        provider = TracerProvider()
        trace.set_tracer_provider(provider)
        FastAPIInstrumentor.instrument_app(app)

        print("[GREEDYLM] OpenTelemetry tracing activado")

    except ImportError:
        # OpenTelemetry no está instalado — modo silencioso
        print("[GREEDYLM] Tracing no disponible (opentelemetry no instalado)")

    except Exception as e:
        # Cualquier otro error no debe romper el startup
        print(f"[GREEDYLM] Tracing error (ignorado): {e}")
