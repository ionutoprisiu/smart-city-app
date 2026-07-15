from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/smart_city_db"
    aco_service_url: str = "http://localhost:8000"
    verification_service_url: str = "http://localhost:8090"
    cors_origins_raw: str = "*"
    jwt_secret_key: str = "dev-only-change-me-use-openssl-rand-hex-32"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7
    sync_attractions_on_startup: bool = True
    seed_admin_user: bool = True
    admin_user_email: str = "admin@admin.com"
    admin_user_password: str = "admin123"
    admin_user_first_name: str = "Admin"
    admin_user_last_name: str = "User"
    verification_upload_dir: str = "uploads/verification"

    @property
    def verification_upload_dir_path(self) -> Path:
        return Path(self.verification_upload_dir)

    @property
    def cors_origins(self) -> list[str]:
        raw = self.cors_origins_raw.strip()
        if raw == "*":
            return ["*"]
        return [x.strip() for x in raw.split(",") if x.strip()]


settings = Settings()
