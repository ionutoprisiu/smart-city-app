from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Minimum face score to enter the admin review queue; final approval is always manual.
    approve_threshold: float = 0.55
    insightface_model_name: str = "buffalo_l"
    insightface_det_size: int = 640
    insightface_det_thresh: float = 0.25
    insightface_min_det_score: float = 0.50
    min_face_px: int = 60
    min_blur_variance: float = 20.0

    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="VERIFICATION_",
        case_sensitive=False,
    )


settings = Settings()
