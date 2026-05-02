from datetime import datetime

from pydantic import BaseModel, Field


class BecomeOrganizerRequest(BaseModel):
    userId: int


class EventCreateRequest(BaseModel):
    creatorUserId: int
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
    creatorUserId: int
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


class ClubJoinRequest(BaseModel):
    userId: int


class UserActorRequest(BaseModel):
    userId: int


class AnnouncementCreateRequest(BaseModel):
    userId: int
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
