from __future__ import annotations

from pathlib import Path

from app.core.config import settings

ID_CARD_NAME = "id_card.jpg"
SELFIE_NAME = "selfie.jpg"


def _user_dir(user_id: int) -> Path:
    return settings.verification_upload_dir_path / str(user_id)


def save_verification_images(user_id: int, id_card_bytes: bytes, selfie_bytes: bytes) -> None:
    directory = _user_dir(user_id)
    directory.mkdir(parents=True, exist_ok=True)
    (directory / ID_CARD_NAME).write_bytes(id_card_bytes)
    (directory / SELFIE_NAME).write_bytes(selfie_bytes)


def id_card_path(user_id: int) -> Path | None:
    path = _user_dir(user_id) / ID_CARD_NAME
    return path if path.is_file() else None


def selfie_path(user_id: int) -> Path | None:
    path = _user_dir(user_id) / SELFIE_NAME
    return path if path.is_file() else None


def document_urls(user_id: int) -> tuple[str | None, str | None]:
    id_url = (
        f"/api/admin/verifications/{user_id}/documents/id-card"
        if id_card_path(user_id)
        else None
    )
    selfie_url = (
        f"/api/admin/verifications/{user_id}/documents/selfie"
        if selfie_path(user_id)
        else None
    )
    return id_url, selfie_url
