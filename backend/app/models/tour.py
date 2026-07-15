from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.common.utc import utc_now
from app.db.base import Base


# A guide-published collection of catalog attractions. The tour stores only WHICH
# attractions (plus a recommended profile); the ORDER is computed by ACO at open
# time, and with a time budget the opening becomes an Orienteering Problem.
class Tour(Base):

    __tablename__ = "tours"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    city: Mapped[str] = mapped_column(String(100), nullable=False, default="Cluj-Napoca")
    routing_profile: Mapped[str] = mapped_column(String(16), nullable=False, default="driving")
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    # Soft delete, consistent with the rest of the system: ACTIVE / DELETED.
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="ACTIVE")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utc_now, onupdate=utc_now, nullable=False
    )


# Join row linking a tour to one catalog attraction, in the guide's order.
class TourAttraction(Base):

    __tablename__ = "tour_attractions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    tour_id: Mapped[int] = mapped_column(ForeignKey("tours.id"), nullable=False)
    attraction_id: Mapped[int] = mapped_column(
        ForeignKey("tourist_attractions.id"), nullable=False
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # The guide's estimate of how long this visit takes — expert knowledge the
    # orienteering optimization consumes (travel + visits must fit the budget).
    visit_duration_minutes: Mapped[float] = mapped_column(
        Float, nullable=False, default=15.0
    )
