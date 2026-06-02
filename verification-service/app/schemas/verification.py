from pydantic import BaseModel, Field


class VerificationMetadataResponse(BaseModel):
    quality_ok: bool = Field(alias="qualityOk")
    id_face_det_score: float = Field(alias="idFaceDetScore")
    id_face_min_dim: float = Field(alias="idFaceMinDim")
    id_face_blur: float = Field(alias="idFaceBlur")
    selfie_face_blur: float = Field(alias="selfieFaceBlur")

    model_config = {"populate_by_name": True}


class VerificationResponse(BaseModel):
    userId: int
    status: str
    score: float
    reason: str
    metadata: VerificationMetadataResponse | None = None
