from fastapi import FastAPI, File, Form, HTTPException, UploadFile

from app.schemas import VerificationResponse
from app.verification_engine import verify_identity, warm_up_models

app = FastAPI(title="Verification Service")


@app.on_event("startup")
def startup() -> None:
    warm_up_models()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/verify", response_model=VerificationResponse)
async def verify(
    userId: int = Form(...),
    idCardImage: UploadFile = File(...),
    selfieImage: UploadFile = File(...),
) -> VerificationResponse:
    try:
        id_card_bytes = await idCardImage.read()
        selfie_bytes = await selfieImage.read()
        result = verify_identity(id_card_bytes=id_card_bytes, selfie_bytes=selfie_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Verification failed: {exc}") from exc

    return VerificationResponse(
        userId=userId,
        status=result.status,
        score=result.score,
        reason=result.reason,
        ocrData=result.ocr_data,
    )
