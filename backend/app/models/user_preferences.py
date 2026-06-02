from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.common.utc import utc_now
from app.db.base import Base


class UserPreferences(Base):
    """Per-user onboarding preferences used to personalize the attraction list.

    ``categories`` stores an ordered, comma-separated list of attraction
    category enum values (first = highest priority). Order is significant: the
    ranking weights earlier categories more.
    """

    __tablename__ = "user_preferences"

    user_id: Mapped[int] = mapped_column("user_id", Integer, primary_key=True)
    categories: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        "created_at", DateTime, default=utc_now, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        "updated_at",
        DateTime,
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
    )
