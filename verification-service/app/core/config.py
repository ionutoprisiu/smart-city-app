from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    approve_threshold: float = 0.55        # cosine similarity needed to auto-approve
    insightface_model_name: str = "buffalo_l"  # the ArcFace model pack used
    insightface_det_size: int = 640        # default detector resolution
    insightface_det_thresh: float = 0.25   # detector's own accept threshold
    insightface_min_det_score: float = 0.50  # our minimum confidence to trust a face
    min_face_px: int = 60                  # smallest acceptable face (shorter side)
    min_blur_variance: float = 20.0        # below this the image is treated as blurry

    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="VERIFICATION_",
        case_sensitive=False,
    )


settings = Settings()
