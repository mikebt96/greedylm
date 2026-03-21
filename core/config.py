from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Entorno
    ENVIRONMENT: str = "production"  # "local", "development", "production"
    DEBUG: bool = False
    SHOW_DOCS: bool = False

    # Servidor
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Base de datos
    DATABASE_URL: str = "postgresql+asyncpg://user:password@localhost:15432/greedylm"

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
    ALLOWED_ORIGINS: list[str] = [
        "https://greedylm.vercel.app",
        "https://greedylm-portal.onrender.com",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    def __init__(self, **values):
        super().__init__(**values)
        
        # Ajustes basados en el entorno
        if self.ENVIRONMENT == "local":
            self.DEBUG = True
            self.SHOW_DOCS = True
        elif self.ENVIRONMENT == "production":
            self.DEBUG = False
            # Validar claves seguras en producción
            if self.JWT_SECRET == "change-me-in-production-at-least-32-chars" or len(self.JWT_SECRET) < 32:
                raise ValueError("JWT_SECRET insecure! You must generate a secure 32+ char key for production.")
            if self.ENCRYPTION_KEY == "change-me-at-least-32-chars" or len(self.ENCRYPTION_KEY) < 32:
                raise ValueError("ENCRYPTION_KEY insecure! You must generate a secure 32+ char key for production.")

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

    # Administrador & Backups
    MASTER_KEY_HASH: str = ""  # Set via MASTER_KEY_HASH env var. Admin endpoints disabled if empty.
    BACKUP_BUCKET: str = "greedylm-backups"
    GITHUB_TOKEN: str = ""

    # OAuth Providers
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GITHUB_CLIENT_ID: str = ""
    GITHUB_CLIENT_SECRET: str = ""

    # Frontend URL (para webhooks y redirects)
    FRONTEND_URL: str = "http://localhost:3000"

    # Render flag (SSL en DB)
    RENDER: bool = False

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()

# Fix para asyncpg en SQLAlchemy
# DATABASE_URL viene como postgresql://, SQLAlchemy necesita postgresql+asyncpg://
if settings.DATABASE_URL.startswith("postgresql://"):
    settings.DATABASE_URL = settings.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
