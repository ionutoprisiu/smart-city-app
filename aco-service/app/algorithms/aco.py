# Ant Colony Optimization for the open TSP (tour anchored at node 0).
from __future__ import annotations

import logging
import random

from app.common.distance import calculate_route_cost

log = logging.getLogger(__name__)

# Classic Ant System defaults; each constant is one tuning lever of the algorithm.
NUM_ANTS = 30                   # tours built per iteration
MAX_ITERATIONS = 200
ALPHA = 1.0                     # weight of pheromone (accumulated experience)
BETA = 2.0                      # weight of visibility 1/cost (pull toward cheap edges)
RHO = 0.5                       # pheromone evaporation rate per iteration
Q = 100.0                       # deposited pheromone, scaled by 1/tour_cost
INITIAL_PHEROMONE = 1.0
EARLY_STOPPING_THRESHOLD = 50   # stop after this many iterations without improvement


class ACOOptimizer:
    def __init__(
        self,
        cost_matrix: list[list[float]],
        seed: int | None = None,
        *,
        num_ants: int = NUM_ANTS,
        max_iterations: int = MAX_ITERATIONS,
        alpha: float = ALPHA,
        beta: float = BETA,
        rho: float = RHO,
        q: float = Q,
        early_stopping_threshold: int = EARLY_STOPPING_THRESHOLD,
    ):
        if not cost_matrix:
            raise ValueError("Cost matrix cannot be empty")
        if len(cost_matrix) < 2:
            raise ValueError("At least 2 points are required")

        self.cost_matrix = cost_matrix
        self.num_points = len(cost_matrix)
        self.num_ants = max(1, int(num_ants))
        self.max_iterations = max(1, int(max_iterations))
        self.alpha = float(alpha)
        self.beta = float(beta)
        self.rho = min(max(float(rho), 0.0), 1.0)
        self.q = float(q)
        self.early_stopping_threshold = max(1, int(early_stopping_threshold))
        self.pheromones = [
            [INITIAL_PHEROMONE for _ in range(self.num_points)]
            for _ in range(self.num_points)
        ]
        self.best_route: list[int] = []
        self.best_cost = float("inf")
        self.cost_history: list[float] = []
        self._rng = random.Random(seed)

        log.info("ACO initialized: %d points", self.num_points)

    def optimize(self) -> tuple[list[int], float]:
        stagnant_iterations = 0

        for iteration in range(self.max_iterations):
            routes: list[list[int]] = []
            costs: list[float] = []
            improved = False

            for _ in range(self.num_ants):
                route = self._construct_route()
                cost = calculate_route_cost(route, self.cost_matrix)
                routes.append(route)
                costs.append(cost)

                if cost < self.best_cost:
                    self.best_cost = cost
                    self.best_route = route.copy()
                    improved = True

            # Update trails only after the whole colony has finished this iteration.
            self._update_pheromones(routes, costs)
            self.cost_history.append(self.best_cost)  # kept for the convergence plot

            stagnant_iterations = 0 if improved else stagnant_iterations + 1
            if stagnant_iterations >= self.early_stopping_threshold:
                log.info("Early stopping at iteration %d", iteration + 1)
                break

        return self.best_route, self.best_cost

    def _visibility(self, i: int, j: int) -> float:
        # 1/cost: cheaper (shorter or faster) edges look more attractive to an ant.
        edge = self.cost_matrix[i][j]
        return 0.0 if edge == 0 else 1.0 / edge

    def _probabilities(self, current: int, unvisited: list[int]) -> list[float]:
        if not unvisited:
            return []

        # Transition rule: P(edge i->j) proportional to pheromone^alpha * visibility^beta.
        numerators = [
            (self.pheromones[current][nxt] ** self.alpha) * (self._visibility(current, nxt) ** self.beta)
            for nxt in unvisited
        ]
        total = sum(numerators)
        if total > 0:
            return [n / total for n in numerators]
        return [1.0 / len(unvisited)] * len(unvisited)  # all-zero weights -> pick uniformly

    def _construct_route(self) -> list[int]:
        route = [0]  # every tour starts at the fixed anchor (node 0 = UTCN)
        unvisited = list(range(1, self.num_points))
        while unvisited:
            current = route[-1]
            probabilities = self._probabilities(current, unvisited)
            # Weighted-random pick (not greedy): keeps exploration alive across ants.
            nxt = self._rng.choices(unvisited, weights=probabilities)[0]
            route.append(nxt)
            unvisited.remove(nxt)
        return route

    def _update_pheromones(self, routes: list[list[int]], costs: list[float]) -> None:
        # 1) Evaporation: every edge loses a fraction rho, so old trails fade.
        for i in range(self.num_points):
            for j in range(self.num_points):
                self.pheromones[i][j] *= 1 - self.rho

        # 2) Deposit: each tour adds Q/cost on its edges — shorter tours reinforce more.
        for route, cost in zip(routes, costs):
            if cost <= 0:
                continue
            deposit = self.q / cost
            for i in range(len(route) - 1):
                self.pheromones[route[i]][route[i + 1]] += deposit
