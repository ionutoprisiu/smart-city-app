# Benchmark lab behind /research (admin "Algoritmi"): ACO/PSO/NN/brute force on fixed
# Cluj sets, Haversine only; stochastic algorithms run N seeds -> mean +/- std.
from __future__ import annotations

import json
import statistics
import time
from functools import lru_cache
from pathlib import Path
from typing import Any, Callable

from app.algorithms.aco import (
    ALPHA,
    BETA,
    EARLY_STOPPING_THRESHOLD,
    MAX_ITERATIONS,
    NUM_ANTS,
    Q,
    RHO,
    ACOOptimizer,
)
from app.algorithms.brute_force import DEFAULT_MAX_POINTS, brute_force
from app.algorithms.nearest_neighbor import nearest_neighbor
from app.algorithms.two_opt import two_opt
from app.algorithms.pso import (
    COGNITIVE,
    EARLY_STOPPING_THRESHOLD as PSO_EARLY_STOPPING,
    INERTIA,
    MAX_ITERATIONS as PSO_MAX_ITERATIONS,
    SOCIAL,
    SWARM_SIZE,
    PSOOptimizer,
)
from app.common.distance import calculate_distance_matrix, calculate_route_cost
from app.common.exceptions import ValidationAppError

DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "benchmark_sets.json"

MAX_RUNS = 50

DEFAULT_ACO_PARAMS: dict[str, float | int] = {
    "numAnts": NUM_ANTS,
    "maxIterations": MAX_ITERATIONS,
    "alpha": ALPHA,
    "beta": BETA,
    "rho": RHO,
    "q": Q,
    "earlyStoppingThreshold": EARLY_STOPPING_THRESHOLD,
}

DEFAULT_PSO_PARAMS: dict[str, float | int] = {
    "swarmSize": SWARM_SIZE,
    "maxIterations": PSO_MAX_ITERATIONS,
    "inertia": INERTIA,
    "cognitive": COGNITIVE,
    "social": SOCIAL,
    "earlyStoppingThreshold": PSO_EARLY_STOPPING,
}


@lru_cache(maxsize=1)
def _load_dataset() -> dict[str, Any]:
    # Benchmark sets rarely change; read the JSON once and cache it in memory.
    with DATA_FILE.open(encoding="utf-8") as fh:
        return json.load(fh)


def _build_points(dataset: dict[str, Any], attraction_ids: list[int]) -> list[dict]:
    pool = {item["id"]: item for item in dataset["pool"]}
    start = dataset["start"]
    points = [{"latitude": start["latitude"], "longitude": start["longitude"]}]
    for attraction_id in attraction_ids:
        item = pool.get(attraction_id)
        if item is None:
            raise ValidationAppError(f"Unknown attraction id: {attraction_id}")
        points.append({"latitude": item["latitude"], "longitude": item["longitude"]})
    return points


def _timed(func: Callable[[], Any]) -> tuple[Any, float]:
    start = time.perf_counter()
    result = func()
    return result, (time.perf_counter() - start) * 1000.0


def list_sets() -> list[dict[str, Any]]:
    dataset = _load_dataset()
    pool = {item["id"]: item for item in dataset["pool"]}
    sets = []
    for set_def in dataset["sets"]:
        ids = set_def["attractionIds"]
        sets.append(
            {
                "name": set_def["name"],
                "n": len(ids) + 1,
                "attractionIds": ids,
                "attractions": [
                    {"id": aid, "name": pool[aid]["name"]} for aid in ids if aid in pool
                ],
            }
        )
    return sets


def _resolve_set(set_name: str) -> dict[str, Any]:
    dataset = _load_dataset()
    for set_def in dataset["sets"]:
        if set_def["name"] == set_name:
            return set_def
    raise ValidationAppError(f"Unknown set: {set_name}")


def _run_aco(
    matrix: list[list[float]],
    runs: int,
    base_seed: int,
    params: dict[str, float | int],
) -> dict[str, Any]:
    costs: list[float] = []
    times_ms: list[float] = []
    best_cost = float("inf")
    best_route: list[int] = []
    best_history: list[float] = []

    # Repeat with a different seed each run so we can report mean/std, not one shot.
    for offset in range(runs):
        seed = base_seed + offset
        optimizer = ACOOptimizer(
            matrix,
            seed=seed,
            num_ants=int(params["numAnts"]),
            max_iterations=int(params["maxIterations"]),
            alpha=float(params["alpha"]),
            beta=float(params["beta"]),
            rho=float(params["rho"]),
            q=float(params["q"]),
            early_stopping_threshold=int(params["earlyStoppingThreshold"]),
        )
        (route, cost), elapsed = _timed(optimizer.optimize)
        costs.append(cost)
        times_ms.append(elapsed)
        if cost < best_cost:
            best_cost = cost
            best_route = route
            best_history = list(optimizer.cost_history)

    return {
        "mean": statistics.fmean(costs),
        "std": statistics.pstdev(costs) if len(costs) > 1 else 0.0,
        "best": best_cost,
        "timeMs": statistics.fmean(times_ms),
        "route": best_route,
        "history": best_history,
    }


def _run_aco_2opt(
    matrix: list[list[float]],
    runs: int,
    base_seed: int,
    params: dict[str, float | int],
) -> dict[str, Any]:
    # Memetic hybrid: ACO explores globally, then 2-opt refines each solution
    # locally. Convergence history is ACO's; the reported cost is post-refinement.
    costs: list[float] = []
    times_ms: list[float] = []
    best_cost = float("inf")
    best_route: list[int] = []
    best_history: list[float] = []

    for offset in range(runs):
        seed = base_seed + offset

        def run(s=seed):
            optimizer = ACOOptimizer(
                matrix,
                seed=s,
                num_ants=int(params["numAnts"]),
                max_iterations=int(params["maxIterations"]),
                alpha=float(params["alpha"]),
                beta=float(params["beta"]),
                rho=float(params["rho"]),
                q=float(params["q"]),
                early_stopping_threshold=int(params["earlyStoppingThreshold"]),
            )
            aco_route, _ = optimizer.optimize()
            refined_route, refined_cost = two_opt(matrix, aco_route)
            return refined_route, refined_cost, optimizer.cost_history

        (route, cost, history), elapsed = _timed(run)
        costs.append(cost)
        times_ms.append(elapsed)
        if cost < best_cost:
            best_cost = cost
            best_route = route
            best_history = list(history)

    return {
        "mean": statistics.fmean(costs),
        "std": statistics.pstdev(costs) if len(costs) > 1 else 0.0,
        "best": best_cost,
        "timeMs": statistics.fmean(times_ms),
        "route": best_route,
        "history": best_history,
    }


def _run_pso(
    matrix: list[list[float]],
    runs: int,
    base_seed: int,
    params: dict[str, float | int],
) -> dict[str, Any]:
    costs: list[float] = []
    times_ms: list[float] = []
    best_cost = float("inf")
    best_route: list[int] = []
    best_history: list[float] = []

    for offset in range(runs):
        seed = base_seed + offset
        optimizer = PSOOptimizer(
            matrix,
            seed=seed,
            swarm_size=int(params["swarmSize"]),
            max_iterations=int(params["maxIterations"]),
            inertia=float(params["inertia"]),
            cognitive=float(params["cognitive"]),
            social=float(params["social"]),
            early_stopping_threshold=int(params["earlyStoppingThreshold"]),
        )
        (route, cost), elapsed = _timed(optimizer.optimize)
        costs.append(cost)
        times_ms.append(elapsed)
        if cost < best_cost:
            best_cost = cost
            best_route = route
            best_history = list(optimizer.cost_history)

    return {
        "mean": statistics.fmean(costs),
        "std": statistics.pstdev(costs) if len(costs) > 1 else 0.0,
        "best": best_cost,
        "timeMs": statistics.fmean(times_ms),
        "route": best_route,
        "history": best_history,
    }


def _improvement_pct(reference: float, value: float) -> float:
    # How much cheaper `value` is than a baseline (e.g. ACO vs the initial order).
    if reference <= 0:
        return 0.0
    return (reference - value) / reference * 100.0


def _gap_pct(optimal: float, value: float) -> float:
    # How far above the exact optimum `value` sits (0% = optimal). Needs brute force.
    if optimal <= 0:
        return 0.0
    return (value - optimal) / optimal * 100.0


def compare(set_name: str, runs: int = 10, seed: int = 0) -> dict[str, Any]:
    # Every algorithm runs on its fixed, documented defaults — a fair,
    # parameter-free comparison (no per-algorithm tuning).
    runs = max(1, min(int(runs), MAX_RUNS))
    aco_cfg = dict(DEFAULT_ACO_PARAMS)
    pso_cfg = dict(DEFAULT_PSO_PARAMS)

    dataset = _load_dataset()
    set_def = _resolve_set(set_name)
    attraction_ids = set_def["attractionIds"]
    points = _build_points(dataset, attraction_ids)
    matrix = calculate_distance_matrix(points)  # Haversine — deterministic, no OSRM
    n = len(points)

    # initial_route = the unoptimized selection order (0,1,2,...): the "do nothing" baseline.
    initial_route = list(range(n))
    initial_cost = calculate_route_cost(initial_route, matrix)

    (greedy_route, greedy_cost), greedy_ms = _timed(lambda: nearest_neighbor(matrix))
    # NN + 2-opt: a strong, deterministic local-search baseline (2-opt over NN).
    (nn2_route, nn2_cost), nn2_ms = _timed(lambda: two_opt(matrix))
    aco = _run_aco(matrix, runs, seed, aco_cfg)
    aco2 = _run_aco_2opt(matrix, runs, seed, aco_cfg)  # memetic hybrid
    pso = _run_pso(matrix, runs, seed, pso_cfg)

    # Exact optimum only where it is computationally feasible (small n).
    optimal_cost: float | None = None
    optimal_ms: float | None = None
    if n <= DEFAULT_MAX_POINTS:
        (_, optimal_cost), optimal_ms = _timed(lambda: brute_force(matrix))

    def _gap(value: float) -> float | None:
        return round(_gap_pct(optimal_cost, value), 2) if optimal_cost else None

    algorithms = [
        {
            "key": "initial",
            "label": "Ordine inițială",
            "cost": round(initial_cost, 3),
            "timeMs": None,
            "improvementPct": 0.0,
            "gapPct": _gap(initial_cost),
        },
        {
            "key": "nearest_neighbor",
            "label": "Nearest neighbor",
            "cost": round(greedy_cost, 3),
            "timeMs": round(greedy_ms, 3),
            "improvementPct": round(_improvement_pct(initial_cost, greedy_cost), 2),
            "gapPct": _gap(greedy_cost),
        },
        {
            "key": "nn_2opt",
            "label": "NN + 2-opt",
            "cost": round(nn2_cost, 3),
            "timeMs": round(nn2_ms, 3),
            "improvementPct": round(_improvement_pct(initial_cost, nn2_cost), 2),
            "gapPct": _gap(nn2_cost),
        },
        {
            "key": "aco",
            "label": "ACO",
            "cost": round(aco["mean"], 3),
            "best": round(aco["best"], 3),
            "std": round(aco["std"], 3),
            "timeMs": round(aco["timeMs"], 3),
            "improvementPct": round(_improvement_pct(initial_cost, aco["mean"]), 2),
            "gapPct": _gap(aco["mean"]),
        },
        {
            "key": "aco_2opt",
            "label": "ACO + 2-opt",
            "cost": round(aco2["mean"], 3),
            "best": round(aco2["best"], 3),
            "std": round(aco2["std"], 3),
            "timeMs": round(aco2["timeMs"], 3),
            "improvementPct": round(_improvement_pct(initial_cost, aco2["mean"]), 2),
            "gapPct": _gap(aco2["mean"]),
        },
        {
            "key": "pso",
            "label": "PSO",
            "cost": round(pso["mean"], 3),
            "best": round(pso["best"], 3),
            "std": round(pso["std"], 3),
            "timeMs": round(pso["timeMs"], 3),
            "improvementPct": round(_improvement_pct(initial_cost, pso["mean"]), 2),
            "gapPct": _gap(pso["mean"]),
        },
    ]

    if optimal_cost is not None:
        algorithms.append(
            {
                "key": "optimal",
                "label": "Brute force (optim)",
                "cost": round(optimal_cost, 3),
                "timeMs": round(optimal_ms or 0.0, 3),
                "improvementPct": round(_improvement_pct(initial_cost, optimal_cost), 2),
                "gapPct": 0.0,
            }
        )

    convergence = [
        {"iteration": i, "cost": round(cost, 3)}
        for i, cost in enumerate(aco["history"], start=1)
    ]
    pso_convergence = [
        {"iteration": i, "cost": round(cost, 3)}
        for i, cost in enumerate(pso["history"], start=1)
    ]

    return {
        "set": {
            "name": set_def["name"],
            "n": n,
            "attractionIds": attraction_ids,
        },
        "runs": runs,
        "seed": seed,
        "acoParams": aco_cfg,
        "psoParams": pso_cfg,
        "algorithms": algorithms,
        "convergence": convergence,
        "psoConvergence": pso_convergence,
        "bruteForceLimit": DEFAULT_MAX_POINTS,
        "optimalAvailable": optimal_cost is not None,
    }
