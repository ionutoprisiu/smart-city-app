from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class TourCreateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=1000)
    routingProfile: str = Field(default="driving")  # "foot" | "driving"
    attractionIds: list[int] = Field(..., min_length=1, max_length=50)
    # Optional, parallel to attractionIds: the guide's estimate of how long each
    # visit takes (minutes). Omitted -> every attraction gets the 15-min default.
    visitDurationsMinutes: list[float] | None = Field(default=None)


class TourOptimizeRequest(BaseModel):
    # The tourist's available time. None -> classic behavior (visit everything).
    timeBudgetMinutes: float | None = Field(default=None, gt=0, le=1440)


class TourAttractionRef(BaseModel):
    attractionId: int
    name: str
    category: str
    latitude: float
    longitude: float
    visitDurationMinutes: float


class TourSummary(BaseModel):
    id: int
    title: str
    description: str | None
    city: str
    routingProfile: str
    createdBy: int
    attractionCount: int
    createdAt: datetime


class TourDetail(BaseModel):
    id: int
    title: str
    description: str | None
    city: str
    routingProfile: str
    createdBy: int
    createdAt: datetime
    attractions: list[TourAttractionRef]
