from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import get_current_user_id, get_db
from app.schemas.verification import VerificationStatusResponse, VerificationSubmitResponse
from app.services import verification_service

router = APIRouter(prefix="/verification", tags=["verification"])


def _runtime_status_code(exc: RuntimeError) -> int:
    if "unavailable" in str(exc).lower():
        return 502
    return 400


@router.post("/submit", response_model=VerificationSubmitResponse)
async def submit_verification(
    idCardImage: UploadFile = File(...),
    selfieImage: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
) -> VerificationSubmitResponse:
    try:
        id_card_bytes = await idCardImage.read()
        selfie_bytes = await selfieImage.read()
        return await verification_service.submit_verification(
            db=db,
            user_id=current_user_id,
            id_card_filename=idCardImage.filename or "id-card.jpg",
            id_card_bytes=id_card_bytes,
            selfie_filename=selfieImage.filename or "selfie.jpg",
            selfie_bytes=selfie_bytes,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=_runtime_status_code(exc), detail=str(exc)) from exc


@router.get("/status", response_model=VerificationStatusResponse)
def get_verification_status(
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
) -> VerificationStatusResponse:
    try:
        return verification_service.get_verification_status(db=db, user_id=current_user_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
