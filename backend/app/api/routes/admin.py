from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_admin_user_id
from app.models.enums import VerificationStatus
from app.schemas.admin import (
    AdminRejectRequest,
    AdminUserItem,
    AdminUserListResponse,
    AdminUserUpdateRequest,
    AdminVerificationListResponse,
)
from app.services import admin_service, verification_storage, visit_city_service

router = APIRouter(prefix="/admin", tags=["admin"])


def _map_value_error(exc: ValueError) -> HTTPException:
    message = str(exc)
    status = 404 if "not found" in message.lower() else 400
    return HTTPException(status_code=status, detail=message)


@router.get("/verifications", response_model=AdminVerificationListResponse)
def list_verifications(
    status: VerificationStatus | None = Query(default=None),
    _admin_id: int = Depends(require_admin_user_id),
    db: Session = Depends(get_db),
) -> AdminVerificationListResponse:
    return admin_service.list_verifications(db, status=status)


@router.get("/verifications/pending", response_model=AdminVerificationListResponse)
def list_pending_verifications(
    _admin_id: int = Depends(require_admin_user_id),
    db: Session = Depends(get_db),
) -> AdminVerificationListResponse:
    return admin_service.list_pending_verifications(db)


@router.get("/verifications/{user_id}/documents/id-card")
def get_id_card_image(
    user_id: int,
    _admin_id: int = Depends(require_admin_user_id),
):
    path = verification_storage.id_card_path(user_id)
    if path is None:
        raise HTTPException(status_code=404, detail="ID card image not found")
    return FileResponse(path)


@router.get("/verifications/{user_id}/documents/selfie")
def get_selfie_image(
    user_id: int,
    _admin_id: int = Depends(require_admin_user_id),
):
    path = verification_storage.selfie_path(user_id)
    if path is None:
        raise HTTPException(status_code=404, detail="Selfie image not found")
    return FileResponse(path)


@router.post("/verifications/{user_id}/approve")
def approve_verification(
    user_id: int,
    _admin_id: int = Depends(require_admin_user_id),
    db: Session = Depends(get_db),
):
    try:
        return admin_service.approve_verification(db, user_id)
    except ValueError as exc:
        raise _map_value_error(exc) from exc


@router.post("/verifications/{user_id}/reject")
def reject_verification(
    user_id: int,
    body: AdminRejectRequest,
    _admin_id: int = Depends(require_admin_user_id),
    db: Session = Depends(get_db),
):
    try:
        return admin_service.reject_verification(db, user_id, body.reason)
    except ValueError as exc:
        raise _map_value_error(exc) from exc


@router.post("/verifications/{user_id}/allow-resubmit")
def allow_resubmit(
    user_id: int,
    _admin_id: int = Depends(require_admin_user_id),
    db: Session = Depends(get_db),
):
    try:
        return admin_service.allow_resubmit(db, user_id)
    except ValueError as exc:
        raise _map_value_error(exc) from exc


@router.get("/users", response_model=AdminUserListResponse)
def list_users(
    _admin_id: int = Depends(require_admin_user_id),
    db: Session = Depends(get_db),
) -> AdminUserListResponse:
    return admin_service.list_users(db)


@router.post("/users/{user_id}/promote-guide")
def promote_guide(
    user_id: int,
    _admin_id: int = Depends(require_admin_user_id),
    db: Session = Depends(get_db),
):
    try:
        return admin_service.promote_to_guide(db, user_id)
    except ValueError as exc:
        raise _map_value_error(exc) from exc


@router.post("/users/{user_id}/demote-user")
def demote_user(
    user_id: int,
    _admin_id: int = Depends(require_admin_user_id),
    db: Session = Depends(get_db),
):
    try:
        return admin_service.demote_to_user(db, user_id)
    except ValueError as exc:
        raise _map_value_error(exc) from exc


@router.post("/users/{user_id}/reset-verification")
def reset_verification(
    user_id: int,
    _admin_id: int = Depends(require_admin_user_id),
    db: Session = Depends(get_db),
):
    try:
        return admin_service.reset_user_verification(db, user_id)
    except ValueError as exc:
        raise _map_value_error(exc) from exc


@router.patch("/users/{user_id}", response_model=AdminUserItem)
def update_user(
    user_id: int,
    body: AdminUserUpdateRequest,
    admin_id: int = Depends(require_admin_user_id),
    db: Session = Depends(get_db),
):
    try:
        return admin_service.update_user(db, user_id, body, admin_id)
    except ValueError as exc:
        raise _map_value_error(exc) from exc


@router.delete("/users/{user_id}", status_code=204)
def delete_user(
    user_id: int,
    admin_id: int = Depends(require_admin_user_id),
    db: Session = Depends(get_db),
):
    try:
        admin_service.delete_user(db, user_id, admin_id)
    except ValueError as exc:
        raise _map_value_error(exc) from exc


@router.post("/attractions/sync")
def sync_attractions(
    _admin_id: int = Depends(require_admin_user_id),
    db: Session = Depends(get_db),
) -> dict:
    return {"data": visit_city_service.sync_attractions(db)}
