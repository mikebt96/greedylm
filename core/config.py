from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Servidor
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = False

    # Base de datos
    DATABASE_URL: str = "postgresql+asyncpg://user:pass@localhost/greedylm"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Qdrant
    QDRANT_URL: str = "https://8ac60b40-4a34-43ae-a091-79e0512099b4.us-west-1-0.aws.cloud.qdrant.io:6333"
    QDRANT_API_KEY: str = ""
    QDRANT_COLLECTION: str = "greedylm_knowledge"

    # JWT
    JWT_SECRET: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_DAYS: int = 90

    # CORS
    ALLOWED_ORIGINS: list[str] = [
        "https://greedylm.vercel.app",
        "https://greedylm-portal.onrender.com",
        "http://localhost:3000"
    ]

    def __init__(self, **values):
        super().__init__(**values)
        # Si ALLOWED_ORIGINS viene como string (desde env), convertir a lista
        if isinstance(self.ALLOWED_ORIGINS, str):
            self.ALLOWED_ORIGINS = [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    # LLM Providers (opcionales)
    ANTHROPIC_API_KEY: str = ""
    OPENAI_API_KEY: str = ""

    # Email
    SENDGRID_API_KEY: str = ""
    EMAIL_FROM: str = "noreply@greedylm.network"

    # Seguridad
    ENCRYPTION_KEY: str = "change-me-32-chars-minimum-please"

    # Stripe
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""

    # Frontend URL (para webhooks y redirects)
    FRONTEND_URL: str = "http://localhost:3000"

    # Render flag (SSL en DB)
    RENDER: bool = False

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()

# Fix para asyncpg en SQLAlchemy
# DATABASE_URL viene como postgresql://, SQLAlchemy necesita postgresql+asyncpg://
if settings.DATABASE_URL.startswith("postgresql://"):
    settings.DATABASE_URL = settings.DATABASE_URL.replace(
        "postgresql://", "postgresql+asyncpg://", 1
    )
