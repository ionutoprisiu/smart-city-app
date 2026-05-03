"""Environment-backed settings (Ollama-compatible OpenAI base URL by default)."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration loaded from environment and optional ``.env`` file."""
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Support AI"
    llm_model: str = "qwen2.5:7b-instruct"
    llm_base_url: str = "http://host.docker.internal:11434/v1"
    llm_api_key: str = "ollama"

    cors_origins_raw: str = "*"

    @property
    def cors_origins(self) -> list[str]:
        raw = (self.cors_origins_raw or "*").strip()
        if raw == "*" or not raw:
            return ["*"]
        return [x.strip() for x in raw.split(",") if x.strip()]

settings = Settings()
