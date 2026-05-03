from datetime import datetime

from pydantic import BaseModel, Field


class EventCreateRequest(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    description: str | None = None
    category: str = "GENERAL"
    city: str = "Cluj-Napoca"
    locationName: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    startsAt: datetime
    endsAt: datetime


class EventResponse(BaseModel):
    id: int
    title: str
    description: str | None = None
    category: str
    city: str
    locationName: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    startsAt: datetime
    endsAt: datetime
    status: str
    createdBy: int
    createdAt: datetime


class ClubCreateRequest(BaseModel):
    name: str = Field(min_length=3, max_length=120)
    description: str | None = None
    category: str = "OTHER"
    city: str = "Cluj-Napoca"
    visibility: str = "PUBLIC"


class ClubResponse(BaseModel):
    id: int
    name: str
    description: str | None = None
    category: str
    city: str
    visibility: str
    status: str
    createdBy: int
    createdAt: datetime
    membersCount: int = 0
    joined: bool = False
    isClubAdmin: bool = False
    membershipStatus: str | None = None


class AnnouncementCreateRequest(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    body: str = Field(min_length=1, max_length=8000)


class AnnouncementResponse(BaseModel):
    id: int
    title: str
    body: str
    eventId: int | None = None
    clubId: int | None = None
    createdBy: int
    createdAt: datetime


class ChatMessageCreateRequest(BaseModel):
    role: str = Field(pattern="^(USER|ORGANIZER)$")
    body: str = Field(min_length=1, max_length=8000)
    inReplyToMessageId: int | None = None


class ChatMessageResponse(BaseModel):
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
    message: ChatMessageResponse
    autoReply: ChatMessageResponse | None = None
