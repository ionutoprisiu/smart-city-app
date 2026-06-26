from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.common.utc import utc_now
from app.db.base import Base


class ActivityAnnouncement(Base):
    __tablename__ = "activity_announcements"
    __table_args__ = (
        CheckConstraint(
            "(event_id IS NOT NULL AND club_id IS NULL) OR (event_id IS NULL AND club_id IS NOT NULL)",
            name="ck_activity_announcements_event_xor_club",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    event_id: Mapped[int | None] = mapped_column(ForeignKey("activity_events.id"), nullable=True)
    club_id: Mapped[int | None] = mapped_column(ForeignKey("clubs.id"), nullable=True)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utc_now)
