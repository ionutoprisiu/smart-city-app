from fastapi import APIRouter, File, Form, UploadFile

from app.schemas import VerificationResponse
from app.services import verify_identity

router = APIRouter()


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/verify", response_model=VerificationResponse)
async def verify(
    userId: int = Form(...),
    idCardImage: UploadFile = File(...),
    selfieImage: UploadFile = File(...),
) -> VerificationResponse:
    id_card_bytes = await idCardImage.read()
    selfie_bytes = await selfieImage.read()
    result = verify_identity(id_card_bytes=id_card_bytes, selfie_bytes=selfie_bytes)

    return VerificationResponse(
        userId=userId,
        status=result.status,
        score=result.score,
        reason=result.reason,
        ocrData=result.ocr_data,
    )

