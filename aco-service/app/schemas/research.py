from __future__ import annotations

from pydantic import BaseModel, Field


class ACOParams(BaseModel):
    numAnts: int = Field(default=30, ge=1, le=200)
    maxIterations: int = Field(default=200, ge=1, le=1000)
    alpha: float = Field(default=1.0, ge=0.0, le=10.0)
    beta: float = Field(default=2.0, ge=0.0, le=10.0)
    rho: float = Field(default=0.5, ge=0.0, le=1.0)
    q: float = Field(default=100.0, gt=0.0, le=10000.0)
    earlyStoppingThreshold: int = Field(default=50, ge=1, le=1000)


class PSOParams(BaseModel):
    swarmSize: int = Field(default=30, ge=1, le=200)
    maxIterations: int = Field(default=200, ge=1, le=1000)
    inertia: float = Field(default=0.7, ge=0.0, le=2.0)
    cognitive: float = Field(default=1.5, ge=0.0, le=5.0)
    social: float = Field(default=1.5, ge=0.0, le=5.0)
    earlyStoppingThreshold: int = Field(default=50, ge=1, le=1000)


class CompareRequest(BaseModel):
    setName: str = Field(..., min_length=1, max_length=64)
    runs: int = Field(default=10, ge=1, le=50)
    seed: int = Field(default=0, ge=0, le=1_000_000)
    acoParams: ACOParams | None = Field(default=None)
    psoParams: PSOParams | None = Field(default=None)


class SetAttraction(BaseModel):
    id: int
    name: str


class BenchmarkSet(BaseModel):
    name: str
    n: int
    attractionIds: list[int]
    attractions: list[SetAttraction] = Field(default_factory=list)
