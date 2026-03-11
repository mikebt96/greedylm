from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache

class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://user:password@localhost:5432/greedylm"
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # Vector DB
    QDRANT_HOST: str = "localhost"
    QDRANT_PORT: int = 6333
    
    # API
    PROJECT_NAME: str = "GREEDYLM"
    VERSION: str = "7.0.0"
    DEBUG: bool = False
    PORT: int = 8000
    HOST: str = "0.0.0.0"
    
    # Observability
    OTLP_ENDPOINT: str = "" # Optional OTLP endpoint
    QDRANT_URL: str = "http://localhost:6333"
    
    # Security
    JWT_SECRET: str = "dev-secret-do-not-use-in-prod"
    ENCRYPTION_KEY: str = "dev-key-do-not-use-in-prod"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

@lru_cache()
def get_settings():
    return Settings()

settings = get_settings()
