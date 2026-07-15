from __future__ import annotations

from pydantic import BaseModel, Field


class CompareRequest(BaseModel):
    # Algorithms run on their fixed, documented default parameters — the
    # comparison is deliberately parameter-free so every algorithm is treated
    # the same (fair, reproducible). Only the set, repetitions and seed vary.
    setName: str = Field(..., min_length=1, max_length=64)
    runs: int = Field(default=10, ge=1, le=50)
    seed: int = Field(default=0, ge=0, le=1_000_000)


class SetAttraction(BaseModel):
    id: int
    name: str


class BenchmarkSet(BaseModel):
    name: str
    n: int
    attractionIds: list[int]
    attractions: list[SetAttraction] = Field(default_factory=list)
