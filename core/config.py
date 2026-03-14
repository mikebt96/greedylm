from pydantic_settings import BaseSettings
from typing import List


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
    QDRANT_URL: str = "http://localhost:6333"
    QDRANT_API_KEY: str = ""
    QDRANT_COLLECTION: str = "greedylm_knowledge"

    # JWT
    JWT_SECRET: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_DAYS: int = 90

    # CORS
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "https://greedylm-portal.onrender.com",
        "https://greedylm.vercel.app",
        "https://greedylm-a08ox79ia-mikebt96s-projects.vercel.app",
        "https://greedylm.network",
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

    # Económico
    MAX_AUTONOMOUS_SPEND_USD: float = 1000.0
    OVERSIGHT_FUND_PERCENTAGE: float = 10.0
    MAX_LIQUID_CAPITAL_USD: float = 500000.0

    # Render / Producción
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
