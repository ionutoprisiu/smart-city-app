"""Scaling benchmark: how the algorithms behave beyond the realistic tourism range.

Real tourist selections are small (<=~15 stops), where every method reaches the
optimum. To show WHERE a metaheuristic earns its place, this script runs on larger
SYNTHETIC instances (uniformly random points around Cluj) that brute force cannot
solve, and adds two strong references the main benchmark lacked:

  * NN + 2-opt   -- the classic local-search baseline;
  * ACO + 2-opt  -- ACO refined by 2-opt (a simple memetic hybrid).

Stochastic methods (ACO, PSO) are averaged over N seeds (mean +/- std); NN and the
2-opt refinements are deterministic. Cost is Haversine km (offline, reproducible).
"""
from __future__ import annotations

import argparse
import csv
import random
import statistics
import time
from pathlib import Path
from typing import Any, Callable

from app.algorithms.aco import ACOOptimizer
from app.algorithms.nearest_neighbor import nearest_neighbor
from app.algorithms.pso import PSOOptimizer
from app.algorithms.two_opt import two_opt
from app.common.distance import calculate_distance_matrix, calculate_route_cost

# UTCN start + a ~11x9 km bounding box over Cluj-Napoca for the random points.
START = {"latitude": 46.7726428, "longitude": 23.5852436}
LAT_RANGE = (46.72, 46.82)
LON_RANGE = (23.53, 23.66)

SIZES = [30, 50, 100]      # total nodes (start + random points)
INSTANCE_SEED = 20260703   # fixed so the synthetic instances are reproducible
RUNS = 10                  # seeds per stochastic algorithm


def synthetic_matrix(total_nodes: int, seed: int) -> list[list[float]]:
    rng = random.Random(seed)
    points = [START]
    for _ in range(total_nodes - 1):
        points.append(
            {
                "latitude": rng.uniform(*LAT_RANGE),
                "longitude": rng.uniform(*LON_RANGE),
            }
        )
    return calculate_distance_matrix(points)


def _timed(func: Callable[[], Any]) -> tuple[Any, float]:
    start = time.perf_counter()
    result = func()
    return result, (time.perf_counter() - start) * 1000.0


def _stochastic(make, matrix: list[list[float]], runs: int, *, refine: bool) -> dict[str, float]:
    costs: list[float] = []
    times_ms: list[float] = []
    for seed in range(runs):
        def run(s=seed):
            route, cost = make(s)
            if refine:
                route, cost = two_opt(matrix, route)
            return cost
        cost, elapsed = _timed(run)
        costs.append(cost)
        times_ms.append(elapsed)
    return {
        "mean": statistics.fmean(costs),
        "std": statistics.pstdev(costs) if len(costs) > 1 else 0.0,
        "best": min(costs),
        "time_ms": statistics.fmean(times_ms),
    }


def evaluate(total_nodes: int, runs: int) -> dict[str, Any]:
    matrix = synthetic_matrix(total_nodes, INSTANCE_SEED)

    initial_cost = calculate_route_cost(list(range(total_nodes)), matrix)
    (_, nn_cost), nn_ms = _timed(lambda: nearest_neighbor(matrix))
    (_, nn2_cost), nn2_ms = _timed(lambda: two_opt(matrix))  # 2-opt over NN start

    aco = _stochastic(lambda s: ACOOptimizer(matrix, seed=s).optimize(), matrix, runs, refine=False)
    aco2 = _stochastic(lambda s: ACOOptimizer(matrix, seed=s).optimize(), matrix, runs, refine=True)
    pso = _stochastic(lambda s: PSOOptimizer(matrix, seed=s).optimize(), matrix, runs, refine=False)

    return {
        "n": total_nodes,
        "initial": initial_cost,
        "nn": {"cost": nn_cost, "ms": nn_ms},
        "nn2opt": {"cost": nn2_cost, "ms": nn2_ms},
        "aco": aco,
        "aco2opt": aco2,
        "pso": pso,
    }


def _impr(reference: float, value: float) -> float:
    return 0.0 if reference <= 0 else (reference - value) / reference * 100.0


def format_markdown(rows: list[dict[str, Any]]) -> str:
    head = (
        "| n | NN | NN+2opt | ACO medie±std | ACO+2opt medie±std | PSO medie±std | "
        "ACO+2opt vs NN | ACO+2opt vs NN+2opt |\n"
        "|---|---|---|---|---|---|---|---|\n"
    )
    lines = []
    for r in rows:
        best = r["aco2opt"]["mean"]
        lines.append(
            f"| {r['n']} | {r['nn']['cost']:.2f} | {r['nn2opt']['cost']:.2f} | "
            f"{r['aco']['mean']:.2f}±{r['aco']['std']:.2f} | "
            f"{r['aco2opt']['mean']:.2f}±{r['aco2opt']['std']:.2f} | "
            f"{r['pso']['mean']:.2f}±{r['pso']['std']:.2f} | "
            f"−{_impr(r['nn']['cost'], best):.1f}% | −{_impr(r['nn2opt']['cost'], best):.1f}% |"
        )
    return head + "\n".join(lines) + "\n"


def write_csv(rows: list[dict[str, Any]], path: Path) -> None:
    with path.open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(
            ["n", "initial", "nn", "nn_ms", "nn2opt", "nn2opt_ms",
             "aco_mean", "aco_std", "aco_ms",
             "aco2opt_mean", "aco2opt_std", "aco2opt_ms",
             "pso_mean", "pso_std", "pso_ms"]
        )
        for r in rows:
            w.writerow(
                [r["n"], f"{r['initial']:.4f}", f"{r['nn']['cost']:.4f}", f"{r['nn']['ms']:.3f}",
                 f"{r['nn2opt']['cost']:.4f}", f"{r['nn2opt']['ms']:.3f}",
                 f"{r['aco']['mean']:.4f}", f"{r['aco']['std']:.4f}", f"{r['aco']['time_ms']:.3f}",
                 f"{r['aco2opt']['mean']:.4f}", f"{r['aco2opt']['std']:.4f}", f"{r['aco2opt']['time_ms']:.3f}",
                 f"{r['pso']['mean']:.4f}", f"{r['pso']['std']:.4f}", f"{r['pso']['time_ms']:.3f}"]
            )


def main() -> None:
    parser = argparse.ArgumentParser(description="Scaling benchmark on synthetic instances.")
    parser.add_argument("--runs", type=int, default=RUNS)
    parser.add_argument("--out-dir", type=Path, default=Path(__file__).resolve().parent / "results")
    args = parser.parse_args()

    args.out_dir.mkdir(parents=True, exist_ok=True)
    rows = [evaluate(n, args.runs) for n in SIZES]

    md = format_markdown(rows)
    print(md)
    (args.out_dir / "scaling.md").write_text(md, encoding="utf-8")
    write_csv(rows, args.out_dir / "scaling.csv")
    print(f"Written to {args.out_dir}/ (scaling.md, scaling.csv)")


if __name__ == "__main__":
    main()
