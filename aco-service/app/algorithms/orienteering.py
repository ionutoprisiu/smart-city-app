# Orienteering Problem solvers: pick which nodes to visit and in what order so that
# travel + visit time fits the budget, maximizing collected score (node 0 = fixed
# start, no score; matrix, service times and budget must share one unit).
from __future__ import annotations

import logging
import random

log = logging.getLogger(__name__)

# Same classic Ant System levers as the TSP variant (aco.py); kept local so the
# two problems can be tuned independently.
NUM_ANTS = 30
MAX_ITERATIONS = 200
ALPHA = 1.0                     # weight of pheromone (accumulated experience)
BETA = 2.0                      # weight of heuristic score/time (bang for the buck)
RHO = 0.5                       # pheromone evaporation rate per iteration
Q = 100.0                       # deposited pheromone, scaled by collected score
INITIAL_PHEROMONE = 1.0
EARLY_STOPPING_THRESHOLD = 50   # stop after this many iterations without improvement

# Exhaustive search explodes even faster than TSP (all subsets x orders), so the
# exact reference is only feasible on small instances.
DEFAULT_MAX_POINTS_EXACT = 10

_EPS = 1e-9  # tolerance for budget comparisons and zero-cost edges


def route_time(
    route: list[int],
    cost_matrix: list[list[float]],
    service_times: list[float] | None = None,
) -> float:
    # Travel along the edges plus per-node visit time.
    travel = sum(cost_matrix[route[i]][route[i + 1]] for i in range(len(route) - 1))
    if service_times is None:
        return travel
    return travel + sum(service_times[node] for node in route)


def collected_score(route: list[int], scores: list[float]) -> float:
    # Node 0 is the anchor, not an attraction — it never contributes score.
    return sum(scores[node] for node in route if node != 0)


def _validate(
    cost_matrix: list[list[float]],
    scores: list[float],
    budget: float,
    service_times: list[float] | None,
) -> list[float]:
    if not cost_matrix:
        raise ValueError("Cost matrix cannot be empty")
    if len(cost_matrix) < 2:
        raise ValueError("At least 2 points are required")
    if len(scores) != len(cost_matrix):
        raise ValueError("scores must have one entry per point")
    if budget <= 0:
        raise ValueError("Time budget must be positive")
    if service_times is None:
        return [0.0] * len(cost_matrix)
    if len(service_times) != len(cost_matrix):
        raise ValueError("service_times must have one entry per point")
    return list(service_times)


def greedy_orienteering(
    cost_matrix: list[list[float]],
    scores: list[float],
    budget: float,
    service_times: list[float] | None = None,
) -> tuple[list[int], float]:
    # Greedy baseline: repeatedly take the best score-per-time node that still fits.
    service = _validate(cost_matrix, scores, budget, service_times)

    route = [0]
    time_used = service[0]
    unvisited = set(range(1, len(cost_matrix)))

    while True:
        current = route[-1]
        best_node, best_ratio = -1, -1.0
        for j in sorted(unvisited):  # sorted -> deterministic tie-breaking
            price = cost_matrix[current][j] + service[j]
            if time_used + price > budget + _EPS:
                continue
            ratio = scores[j] / max(price, _EPS)
            if ratio > best_ratio:
                best_node, best_ratio = j, ratio
        if best_node < 0:
            break  # nothing else fits in the remaining budget
        time_used += cost_matrix[current][best_node] + service[best_node]
        route.append(best_node)
        unvisited.discard(best_node)

    return route, collected_score(route, scores)


def brute_force_orienteering(
    cost_matrix: list[list[float]],
    scores: list[float],
    budget: float,
    service_times: list[float] | None = None,
    max_points: int = DEFAULT_MAX_POINTS_EXACT,
) -> tuple[list[int], float]:
    # Exact optimum via DFS over feasible paths; prunes on budget (any prefix of a
    # feasible path is feasible), still exponential — small n only.
    service = _validate(cost_matrix, scores, budget, service_times)
    n = len(cost_matrix)
    if n > max_points:
        raise ValueError(f"Exact OP search is limited to {max_points} points (got {n})")

    best_route = [0]
    best_score = 0.0
    best_time = service[0]
    route = [0]
    visited = [False] * n
    visited[0] = True

    def dfs(current: int, time_used: float, score: float) -> None:
        nonlocal best_route, best_score, best_time
        # Every partial path is a candidate answer (ties: prefer the faster one).
        if score > best_score + _EPS or (
            abs(score - best_score) <= _EPS and time_used < best_time - _EPS
        ):
            best_route = route.copy()
            best_score = score
            best_time = time_used
        for j in range(1, n):
            if visited[j]:
                continue
            new_time = time_used + cost_matrix[current][j] + service[j]
            if new_time > budget + _EPS:
                continue
            visited[j] = True
            route.append(j)
            dfs(j, new_time, score + scores[j])
            route.pop()
            visited[j] = False

    dfs(0, service[0], 0.0)
    return best_route, best_score


# ACO adapted to the OP — three changes versus the TSP colony (aco.py): construction
# stops when nothing fits the budget, the heuristic becomes score/time and pheromone
# reinforces high-scoring routes; the rest is kept identical on purpose.
class OrienteeringACO:

    def __init__(
        self,
        cost_matrix: list[list[float]],
        scores: list[float],
        budget: float,
        seed: int | None = None,
        *,
        service_times: list[float] | None = None,
        num_ants: int = NUM_ANTS,
        max_iterations: int = MAX_ITERATIONS,
        alpha: float = ALPHA,
        beta: float = BETA,
        rho: float = RHO,
        q: float = Q,
        early_stopping_threshold: int = EARLY_STOPPING_THRESHOLD,
    ):
        self.service_times = _validate(cost_matrix, scores, budget, service_times)
        self.cost_matrix = cost_matrix
        self.scores = scores
        self.budget = float(budget)
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
        # Normalizes deposits so their magnitude does not depend on score units.
        self._total_score = max(sum(scores[1:]), _EPS)
        self.best_route: list[int] = [0]
        self.best_score = 0.0
        self.best_time = self.service_times[0]
        self.score_history: list[float] = []  # kept for the convergence plot
        self._rng = random.Random(seed)

        log.info("Orienteering ACO initialized: %d points, budget %.1f", self.num_points, budget)

    def optimize(self) -> tuple[list[int], float]:
        stagnant_iterations = 0

        for iteration in range(self.max_iterations):
            routes: list[list[int]] = []
            route_scores: list[float] = []
            improved = False

            for _ in range(self.num_ants):
                route, score, time_used = self._construct_route()
                routes.append(route)
                route_scores.append(score)

                # Higher score wins; equal score, the faster route wins.
                if score > self.best_score + _EPS or (
                    abs(score - self.best_score) <= _EPS and time_used < self.best_time - _EPS
                ):
                    self.best_score = score
                    self.best_time = time_used
                    self.best_route = route.copy()
                    improved = True

            self._update_pheromones(routes, route_scores)
            self.score_history.append(self.best_score)

            stagnant_iterations = 0 if improved else stagnant_iterations + 1
            if stagnant_iterations >= self.early_stopping_threshold:
                log.info("Early stopping at iteration %d", iteration + 1)
                break

        return self.best_route, self.best_score

    def _heuristic(self, i: int, j: int) -> float:
        # Score per unit of time: the "price" of j is getting there AND visiting it.
        price = self.cost_matrix[i][j] + self.service_times[j]
        return self.scores[j] / max(price, _EPS)

    def _feasible(self, current: int, j: int, time_used: float) -> bool:
        return time_used + self.cost_matrix[current][j] + self.service_times[j] <= self.budget + _EPS

    def _construct_route(self) -> tuple[list[int], float, float]:
        route = [0]  # anchored at the fixed start (node 0 = UTCN)
        time_used = self.service_times[0]
        score = 0.0
        unvisited = set(range(1, self.num_points))

        while True:
            current = route[-1]
            candidates = [j for j in unvisited if self._feasible(current, j, time_used)]
            if not candidates:
                break  # budget exhausted: the route ends here, wherever it is

            weights = [
                (self.pheromones[current][j] ** self.alpha) * (self._heuristic(current, j) ** self.beta)
                for j in candidates
            ]
            if sum(weights) <= 0:
                weights = [1.0] * len(candidates)  # all-zero weights -> pick uniformly
            nxt = self._rng.choices(candidates, weights=weights)[0]

            time_used += self.cost_matrix[current][nxt] + self.service_times[nxt]
            score += self.scores[nxt]
            route.append(nxt)
            unvisited.discard(nxt)

        return route, score, time_used

    def _update_pheromones(self, routes: list[list[int]], route_scores: list[float]) -> None:
        # 1) Evaporation: identical to the TSP variant.
        for i in range(self.num_points):
            for j in range(self.num_points):
                self.pheromones[i][j] *= 1 - self.rho

        # 2) Deposit: proportional to the fraction of total score collected, so
        #    routes that gather more prizes attract more ants next iteration.
        for route, score in zip(routes, route_scores):
            if score <= 0 or len(route) < 2:
                continue
            deposit = self.q * (score / self._total_score)
            for i in range(len(route) - 1):
                self.pheromones[route[i]][route[i + 1]] += deposit
