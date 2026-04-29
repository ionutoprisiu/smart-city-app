from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas.verification import VerificationStatusResponse, VerificationSubmitResponse
from app.services import verification_service

router = APIRouter(prefix="/verification", tags=["verification"])


@router.post("/submit", response_model=VerificationSubmitResponse)
async def submit_verification(
    userId: int = Form(...),
    idCardImage: UploadFile = File(...),
    selfieImage: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> VerificationSubmitResponse:
    try:
        id_card_bytes = await idCardImage.read()
        selfie_bytes = await selfieImage.read()
        return await verification_service.submit_verification(
            db=db,
            user_id=userId,
            id_card_filename=idCardImage.filename or "id-card.jpg",
            id_card_bytes=id_card_bytes,
            selfie_filename=selfieImage.filename or "selfie.jpg",
            selfie_bytes=selfie_bytes,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except RuntimeError as exc:
        status_code = 502 if "unavailable" in str(exc).lower() else 400
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc


@router.get("/status/{user_id}", response_model=VerificationStatusResponse)
def get_verification_status(user_id: int, db: Session = Depends(get_db)) -> VerificationStatusResponse:
    try:
        return verification_service.get_verification_status(db=db, user_id=user_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
