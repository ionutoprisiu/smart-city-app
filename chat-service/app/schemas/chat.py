from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ChatMessageCreateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    role: str = Field(pattern="^(USER|ORGANIZER)$")
    body: str = Field(min_length=1, max_length=8000)
    inReplyToMessageId: int | None = None
    threadUserId: int | None = None


class ChatMessageResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: int
    eventId: int | None = None
    clubId: int | None = None
    senderUserId: int
    threadUserId: int | None = None
    role: str
    body: str
    inReplyToMessageId: int | None = None
    isAutoReply: bool
    isApproved: bool
    createdAt: datetime
    senderEmail: str | None = None
    senderIsOrganizer: bool = False


class ChatPostResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    message: ChatMessageResponse
    autoReply: ChatMessageResponse | None = None


class ChatMessageDeleteResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    messageId: int
    inReplyToMessageId: int | None = None
    threadUserId: int | None = None


class AutoreplyOutcome(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    autoReply: ChatMessageResponse | None = None
    pruned: list[ChatMessageDeleteResponse] = Field(default_factory=list)


class ChatThreadResponse(BaseModel):

    model_config = ConfigDict(populate_by_name=True)

    threadUserId: int
    userEmail: str
    lastMessageBody: str
    lastMessageAt: datetime
    lastMessageRole: str
    messageCount: int
