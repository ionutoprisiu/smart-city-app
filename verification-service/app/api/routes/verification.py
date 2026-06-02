from fastapi import APIRouter, File, Form, UploadFile

from app.schemas import VerificationMetadataResponse, VerificationResponse
from app.services import verify_identity

router = APIRouter(tags=["verification"])


@router.get("/health", tags=["system"])
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/verify", response_model=VerificationResponse)
async def verify(
    userId: int = Form(...),
    idCardImage: UploadFile = File(...),
    selfieImage: UploadFile = File(...),
) -> VerificationResponse:
    result = verify_identity(
        id_card_bytes=await idCardImage.read(),
        selfie_bytes=await selfieImage.read(),
    )

    return VerificationResponse(
        userId=userId,
        status=result.status.value,
        score=result.score,
        reason=result.reason,
        metadata=VerificationMetadataResponse.model_validate(result.metadata.as_dict()),
    )
