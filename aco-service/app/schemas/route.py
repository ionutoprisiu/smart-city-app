from __future__ import annotations

from pydantic import BaseModel, Field, field_validator

MAX_ATTRACTIONS = 50


class AttractionRequest(BaseModel):
    id: int = Field(..., gt=0)
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)


class OptimizeRequest(BaseModel):
    # The start point is a fixed anchor (UTCN) injected by the service, not the
    # client — see route_service / route_start. Only attractions are supplied.
    attractions: list[AttractionRequest] = Field(..., min_length=1, max_length=MAX_ATTRACTIONS)
    useOsrm: bool = Field(default=True)
    routingProfile: str = Field(default="driving")

    @field_validator("routingProfile")
    @classmethod
    def validate_profile(cls, v: str) -> str:
        p = (v or "driving").strip().lower()
        if p not in ("driving", "foot"):
            raise ValueError("routingProfile must be 'driving' or 'foot'")
        return p


class RouteStepResponse(BaseModel):
    order: int = Field(..., gt=0)
    attractionId: int
    attractionName: str
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    distanceToNext: float | None = Field(default=None, ge=0)


class OptimizeResponse(BaseModel):
    steps: list[RouteStepResponse]
    totalDistance: float = Field(..., ge=0)
    totalTime: int = Field(..., ge=0)
    travelTimeMinutes: int = Field(..., ge=0)
    visitTimeMinutes: int = Field(..., ge=0)
    path: list[dict]
    routeGeometry: list[dict] = Field(default_factory=list)
    routeSegments: list[list[dict]] = Field(default_factory=list)
    usedOsrm: bool = False
    routingProfile: str = "driving"
