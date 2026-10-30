from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parents[3]
BACKEND_ROOT = Path(__file__).resolve().parents[2]
UPLOADS_ROOT = BACKEND_ROOT / "uploads"


class Settings(BaseSettings):
    app_name: str = "FoodLoop API"
    app_env: str = "development"
    api_prefix: str = "/api"
    database_url: str = f"sqlite:///{(BACKEND_ROOT / 'data' / 'foodloop.db').as_posix()}"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    jwt_secret_key: str = ""
    max_upload_size_bytes: int = 5 * 1024 * 1024
    uploads_root: Path = UPLOADS_ROOT

    model_config = SettingsConfigDict(
        env_file=PROJECT_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
