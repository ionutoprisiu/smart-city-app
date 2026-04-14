from pydantic import computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/licenta_db"
    aco_service_url: str = "http://localhost:8000"
    verification_service_url: str = "http://localhost:8090"
    cors_origins_raw: str = "*"

    # Local/dev only: create one user if the users table has no row with this email.
    seed_demo_user: bool = False
    demo_user_email: str = "demo@example.com"
    demo_user_password: str = "demo1234"
    demo_user_first_name: str = "Demo"
    demo_user_last_name: str = "User"

    # Local/dev only: optional admin seed account.
    seed_admin_user: bool = True
    admin_user_email: str = "admin@admin.com"
    admin_user_password: str = "admin"
    admin_user_first_name: str = "Admin"
    admin_user_last_name: str = "User"

    @computed_field  # type: ignore[prop-decorator]
    @property
    def cors_origins(self) -> list[str]:
        raw = self.cors_origins_raw.strip()
        if raw == "*":
            return ["*"]
        return [x.strip() for x in raw.split(",") if x.strip()]


settings = Settings()
