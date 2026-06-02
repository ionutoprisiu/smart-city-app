from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Chat Service"
    database_url: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/smart_city_db"
    jwt_secret_key: str = "dev-only-change-me-use-openssl-rand-hex-32"
    jwt_algorithm: str = "HS256"
    cors_origins_raw: str = "*"
    llm_model: str = "qwen2.5:7b-instruct"
    llm_base_url: str = "http://host.docker.internal:11434/v1"
    llm_api_key: str = "ollama"

    @property
    def cors_origins(self) -> list[str]:
        raw = self.cors_origins_raw.strip()
        if raw == "*":
            return ["*"]
        return [o.strip() for o in raw.split(",") if o.strip()]


settings = Settings()
