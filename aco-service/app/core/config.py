from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_PUBLIC_OSRM = "https://router.project-osrm.org"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")

    osrm_base_url: str = DEFAULT_PUBLIC_OSRM
    osrm_foot_base_url: str | None = None
    osrm_driving_base_url: str | None = None
    http_osrm_timeout_seconds: float = 25.0

    walking_speed_kmh: float = 4.0
    driving_speed_kmh: float = 28.0

    aco_seed: int = 42

    @property
    def aco_seed_value(self) -> int | None:
        return self.aco_seed if self.aco_seed >= 0 else None

    cors_origins_raw: str = "*"

    @property
    def cors_origins(self) -> list[str]:
        raw = (self.cors_origins_raw or "*").strip()
        if raw == "*" or not raw:
            return ["*"]
        return [origin.strip() for origin in raw.split(",") if origin.strip()]

    def osrm_url_for_profile(self, profile: str) -> str:
        normalized = (profile or "driving").strip().lower()
        if normalized == "foot":
            url = self.osrm_foot_base_url or self.osrm_base_url
        else:
            url = self.osrm_driving_base_url or self.osrm_base_url
        return url.rstrip("/")


settings = Settings()
