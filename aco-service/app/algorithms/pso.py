"""Particle Swarm Optimization for the TSP via random-key encoding.

PSO works on continuous vectors, so each attraction gets a continuous "key" in
[0,1]; sorting the keys yields a permutation. This turns the discrete TSP into a
continuous problem the swarm can optimize. Used only as a secondary, uncalibrated
baseline against ACO.
"""
from __future__ import annotations

import logging
import random

from app.common.distance import calculate_route_cost

log = logging.getLogger(__name__)

SWARM_SIZE = 30
MAX_ITERATIONS = 200
INERTIA = 0.7      # how much of the previous velocity a particle keeps
COGNITIVE = 1.5    # pull toward the particle's own best position
SOCIAL = 1.5       # pull toward the swarm's global best position
EARLY_STOPPING_THRESHOLD = 50
KEY_MIN = 0.0
KEY_MAX = 1.0


def _decode(keys: list[float], num_points: int) -> list[int]:
    # Sort attractions by their continuous key -> a tour permutation anchored at 0.
    cities = list(range(1, num_points))
    cities.sort(key=lambda c: keys[c - 1])
    return [0, *cities]


def _clamp(value: float) -> float:
    return max(KEY_MIN, min(KEY_MAX, value))


class PSOOptimizer:
    def __init__(
        self,
        cost_matrix: list[list[float]],
        seed: int | None = None,
        *,
        swarm_size: int = SWARM_SIZE,
        max_iterations: int = MAX_ITERATIONS,
        inertia: float = INERTIA,
        cognitive: float = COGNITIVE,
        social: float = SOCIAL,
        early_stopping_threshold: int = EARLY_STOPPING_THRESHOLD,
    ):
        if not cost_matrix:
            raise ValueError("Cost matrix cannot be empty")
        if len(cost_matrix) < 2:
            raise ValueError("At least 2 points are required")

        self.cost_matrix = cost_matrix
        self.num_points = len(cost_matrix)
        self.dim = self.num_points - 1
        self.swarm_size = max(1, int(swarm_size))
        self.max_iterations = max(1, int(max_iterations))
        self.inertia = float(inertia)
        self.cognitive = float(cognitive)
        self.social = float(social)
        self.early_stopping_threshold = max(1, int(early_stopping_threshold))
        self._rng = random.Random(seed)

        self.best_route: list[int] = []
        self.best_cost = float("inf")
        self.cost_history: list[float] = []

        log.info("PSO initialized: %d points, swarm %d", self.num_points, self.swarm_size)

    def _cost(self, keys: list[float]) -> float:
        return calculate_route_cost(_decode(keys, self.num_points), self.cost_matrix)

    def optimize(self) -> tuple[list[int], float]:
        # Each particle is a vector of random keys; velocity starts at zero.
        positions = [[self._rng.random() for _ in range(self.dim)] for _ in range(self.swarm_size)]
        velocities = [[0.0] * self.dim for _ in range(self.swarm_size)]

        # pbest = best each particle has seen; gbest (below) = best across the swarm.
        pbest_pos = [p[:] for p in positions]
        pbest_cost = [self._cost(p) for p in positions]

        gbest_idx = min(range(self.swarm_size), key=lambda i: pbest_cost[i])
        gbest_pos = pbest_pos[gbest_idx][:]
        gbest_cost = pbest_cost[gbest_idx]

        self.best_route = _decode(gbest_pos, self.num_points)
        self.best_cost = gbest_cost

        stagnant_iterations = 0

        for iteration in range(self.max_iterations):
            improved = False
            for i in range(self.swarm_size):
                r1 = self._rng.random()
                r2 = self._rng.random()
                for d in range(self.dim):
                    # Standard PSO velocity: inertia + pull to personal best + pull to global best.
                    velocities[i][d] = (
                        self.inertia * velocities[i][d]
                        + self.cognitive * r1 * (pbest_pos[i][d] - positions[i][d])
                        + self.social * r2 * (gbest_pos[d] - positions[i][d])
                    )
                    positions[i][d] = _clamp(positions[i][d] + velocities[i][d])  # keep keys in [0,1]

                cost = self._cost(positions[i])
                if cost < pbest_cost[i]:
                    pbest_cost[i] = cost
                    pbest_pos[i] = positions[i][:]
                    if cost < gbest_cost:
                        gbest_cost = cost
                        gbest_pos = positions[i][:]
                        self.best_cost = cost
                        self.best_route = _decode(gbest_pos, self.num_points)
                        improved = True

            self.cost_history.append(self.best_cost)
            stagnant_iterations = 0 if improved else stagnant_iterations + 1
            if stagnant_iterations >= self.early_stopping_threshold:
                log.info("PSO early stopping at iteration %d", iteration + 1)
                break

        return self.best_route, self.best_cost
