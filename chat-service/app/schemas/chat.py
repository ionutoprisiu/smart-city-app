from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ChatMessageCreateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    role: str = Field(pattern="^(USER|ORGANIZER)$")
    body: str = Field(min_length=1, max_length=8000)
    inReplyToMessageId: int | None = None


class ChatMessageResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: int
    eventId: int | None = None
    clubId: int | None = None
    senderUserId: int
    role: str
    body: str
    inReplyToMessageId: int | None = None
    isAutoReply: bool
    createdAt: datetime


class ChatPostResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    message: ChatMessageResponse
    autoReply: ChatMessageResponse | None = None
