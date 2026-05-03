from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.common.utc import utc_now
from app.db.base import Base


class TouristAttraction(Base):
    __tablename__ = "tourist_attractions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    city: Mapped[str] = mapped_column(String(100), nullable=False)
    category: Mapped[str] = mapped_column(String(32), nullable=False)
    image_url: Mapped[str | None] = mapped_column("image_url", String(500), nullable=True)
    estimated_visit_time: Mapped[int] = mapped_column(
        "estimated_visit_time", Integer, default=30, nullable=False
    )
    is_active: Mapped[bool] = mapped_column("is_active", Boolean, default=True, nullable=False)
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
