from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    approve_threshold: float = 0.62
    manual_threshold: float = 0.50
    insightface_model_name: str = "buffalo_l"
    insightface_det_size: int = 1280
    insightface_det_thresh: float = 0.22

    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="VERIFICATION_",
        case_sensitive=False,
    )


settings = Settings()

