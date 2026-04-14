from pydantic import BaseModel, ConfigDict, field_validator


class OptimizeRouteBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    attractionIds: list[int]
    startLatitude: float | None = None
    startLongitude: float | None = None
    routingProfile: str = "driving"

    @field_validator("routingProfile", mode="before")
    @classmethod
    def normalize_routing_profile(cls, v: object) -> str:
        if v is None or (isinstance(v, str) and not str(v).strip()):
            return "driving"
        return str(v).strip().lower()
