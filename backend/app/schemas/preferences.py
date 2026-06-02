from pydantic import BaseModel


class PreferencesResponse(BaseModel):
    completed: bool
    categories: list[str]


class PreferencesUpdate(BaseModel):
    categories: list[str]
