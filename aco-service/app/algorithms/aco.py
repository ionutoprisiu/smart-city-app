"""Ant Colony Optimization for the open-tour TSP.

Pure algorithm: takes a cost matrix, returns the best route (always anchored
at index 0) and its accumulated cost. No HTTP, no logging configuration —
caller decides what cost matrix to feed in (haversine, OSRM duration, etc.).
"""

from __future__ import annotations

import logging
import random

from app.common.distance import calculate_route_cost

log = logging.getLogger(__name__)

NUM_ANTS = 30
MAX_ITERATIONS = 200
ALPHA = 1.0
BETA = 2.0
RHO = 0.5
Q = 100.0
INITIAL_PHEROMONE = 1.0
EARLY_STOPPING_THRESHOLD = 50


class ACOOptimizer:
    """Ant System–style ACO: stochastic construction + pheromone deposit/evaporation on a cost matrix."""

    def __init__(self, cost_matrix: list[list[float]]):
        if not cost_matrix:
            raise ValueError("Cost matrix cannot be empty")
        if len(cost_matrix) < 2:
            raise ValueError("At least 2 points are required")

        self.cost_matrix = cost_matrix
        self.num_points = len(cost_matrix)
        self.pheromones = [
            [INITIAL_PHEROMONE for _ in range(self.num_points)]
            for _ in range(self.num_points)
        ]
        self.best_route: list[int] = []
        self.best_cost = float("inf")

        log.info("ACO initialized: %d points", self.num_points)

    def optimize(self) -> tuple[list[int], float]:
        no_improvement_count = 0

        for iteration in range(MAX_ITERATIONS):
            routes: list[list[int]] = []
            costs: list[float] = []

            for _ in range(NUM_ANTS):
                route = self._construct_route()
                cost = calculate_route_cost(route, self.cost_matrix)
                routes.append(route)
                costs.append(cost)

                if cost < self.best_cost:
                    self.best_cost = cost
                    self.best_route = route.copy()
                    no_improvement_count = 0
                else:
                    no_improvement_count += 1

            self._update_pheromones(routes, costs)

            if no_improvement_count > EARLY_STOPPING_THRESHOLD:
                log.info("Early stopping at iteration %d", iteration + 1)
                break

        return self.best_route, self.best_cost

    def _visibility(self, i: int, j: int) -> float:
        edge = self.cost_matrix[i][j]
        return 0.0 if edge == 0 else 1.0 / edge

    def _probabilities(self, current: int, unvisited: list[int]) -> list[float]:
        if not unvisited:
            return []

        numerators = [
            (self.pheromones[current][nxt] ** ALPHA) * (self._visibility(current, nxt) ** BETA)
            for nxt in unvisited
        ]
        total = sum(numerators)
        if total > 0:
            return [n / total for n in numerators]
        return [1.0 / len(unvisited)] * len(unvisited)

    def _construct_route(self) -> list[int]:
        """Build one tour anchored at index 0."""
        route = [0]
        unvisited = list(range(1, self.num_points))
        while unvisited:
            current = route[-1]
            probabilities = self._probabilities(current, unvisited)
            nxt = random.choices(unvisited, weights=probabilities)[0]
            route.append(nxt)
            unvisited.remove(nxt)
        return route

    def _update_pheromones(self, routes: list[list[int]], costs: list[float]) -> None:
        for i in range(self.num_points):
            for j in range(self.num_points):
                self.pheromones[i][j] *= 1 - RHO

        for route, cost in zip(routes, costs):
            if cost <= 0:
                continue
            deposit = Q / cost
            for i in range(len(route) - 1):
                self.pheromones[route[i]][route[i + 1]] += deposit
