from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.common.utc import utc_now
from app.db.base import Base


class ActivityChatMessage(Base):
    __tablename__ = "activity_chat_messages"
    __table_args__ = (
        CheckConstraint(
            "(event_id IS NOT NULL AND club_id IS NULL) OR (event_id IS NULL AND club_id IS NOT NULL)",
            name="ck_activity_chat_messages_event_xor_club",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event_id: Mapped[int | None] = mapped_column(ForeignKey("activity_events.id"), nullable=True)
    club_id: Mapped[int | None] = mapped_column(ForeignKey("clubs.id"), nullable=True)
    sender_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    in_reply_to_message_id: Mapped[int | None] = mapped_column(
        ForeignKey("activity_chat_messages.id"),
        nullable=True,
    )
    is_auto_reply: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utc_now)
