from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    password: Mapped[str] = mapped_column(String, nullable=False)
    first_name: Mapped[str] = mapped_column("first_name", String, nullable=False)
    last_name: Mapped[str] = mapped_column("last_name", String, nullable=False)
    name: Mapped[str] = mapped_column(String(500), nullable=False)
    phone_number: Mapped[str | None] = mapped_column("phone_number", String, nullable=True)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    is_verified: Mapped[bool] = mapped_column("is_verified", Boolean, default=False, nullable=False)
    is_approved: Mapped[bool] = mapped_column("is_approved", Boolean, default=False, nullable=False)
    id_card_image_url: Mapped[str | None] = mapped_column("id_card_image_url", String(500), nullable=True)
    face_image_url: Mapped[str | None] = mapped_column("face_image_url", String(500), nullable=True)
    verification_status: Mapped[str] = mapped_column(
        "verification_status",
        String(32),
        default="NOT_SUBMITTED",
        nullable=False,
    )
    verification_score: Mapped[float | None] = mapped_column("verification_score", Float, nullable=True)
    verification_reason: Mapped[str | None] = mapped_column("verification_reason", String(255), nullable=True)
    id_document_ocr_json: Mapped[str | None] = mapped_column("id_document_ocr_json", String(4000), nullable=True)
    created_at: Mapped[datetime | None] = mapped_column("created_at", DateTime, nullable=True)
    verified_at: Mapped[datetime | None] = mapped_column("verified_at", DateTime, nullable=True)
    last_login: Mapped[datetime | None] = mapped_column("last_login", DateTime, nullable=True)
