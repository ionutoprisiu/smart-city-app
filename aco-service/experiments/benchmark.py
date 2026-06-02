"""Benchmark ACO against baselines on fixed Cluj-Napoca attraction sets.

Generates the experimental evidence for the thesis "Testing and validation"
chapter: for each attraction set it compares the initial (unoptimized) order,
the nearest-neighbor greedy heuristic, ACO (averaged over several seeds) and,
for small instances, the exact brute-force optimum. Distances use the
Haversine metric so the script runs fully offline (no OSRM/Docker required).

Usage (from the aco-service directory):

    python -m experiments.benchmark
    python -m experiments.benchmark --runs 20 --out-dir experiments/results

Outputs (printed and written under ``--out-dir``):
    - comparison.md   Markdown table for direct inclusion in LaTeX
    - comparison.csv  same data, machine-readable
    - convergence.csv ACO best-cost per iteration for the largest set
"""

from __future__ import annotations

import argparse
import json
import statistics
import time
from pathlib import Path
from typing import Any

from app.algorithms.aco import ACOOptimizer
from app.algorithms.brute_force import DEFAULT_MAX_POINTS, brute_force
from app.algorithms.nearest_neighbor import nearest_neighbor
from app.common.distance import calculate_distance_matrix, calculate_route_cost

DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "benchmark_sets.json"


def load_dataset(path: Path = DATA_FILE) -> dict[str, Any]:
    with path.open(encoding="utf-8") as fh:
        return json.load(fh)


def build_points(dataset: dict[str, Any], attraction_ids: list[int]) -> list[dict]:
    """Start point at index 0, then the selected attractions in id order."""
    pool = {item["id"]: item for item in dataset["pool"]}
    start = dataset["start"]
    points = [{"latitude": start["latitude"], "longitude": start["longitude"]}]
    for attraction_id in attraction_ids:
        item = pool[attraction_id]
        points.append({"latitude": item["latitude"], "longitude": item["longitude"]})
    return points


def _timed(func) -> tuple[Any, float]:
    start = time.perf_counter()
    result = func()
    return result, (time.perf_counter() - start) * 1000.0


def run_aco(matrix: list[list[float]], runs: int) -> dict[str, float]:
    """Run ACO ``runs`` times with distinct seeds; report cost stats + mean time."""
    costs: list[float] = []
    times_ms: list[float] = []
    best_cost = float("inf")
    for seed in range(runs):
        (_, cost), elapsed = _timed(lambda s=seed: ACOOptimizer(matrix, seed=s).optimize())
        costs.append(cost)
        times_ms.append(elapsed)
        best_cost = min(best_cost, cost)
    return {
        "mean": statistics.fmean(costs),
        "std": statistics.pstdev(costs) if len(costs) > 1 else 0.0,
        "best": best_cost,
        "time_ms": statistics.fmean(times_ms),
    }


def evaluate_set(dataset: dict[str, Any], set_def: dict[str, Any], runs: int) -> dict[str, Any]:
    attraction_ids = set_def["attractionIds"]
    points = build_points(dataset, attraction_ids)
    matrix = calculate_distance_matrix(points)
    n = len(points)

    initial_route = list(range(n))
    initial_cost = calculate_route_cost(initial_route, matrix)

    (greedy_route, greedy_cost), greedy_ms = _timed(lambda: nearest_neighbor(matrix))
    aco = run_aco(matrix, runs)

    optimal_cost: float | None = None
    optimal_ms: float | None = None
    if n <= DEFAULT_MAX_POINTS:
        (_, optimal_cost), optimal_ms = _timed(lambda: brute_force(matrix))

    return {
        "name": set_def["name"],
        "n": n,
        "initial_cost": initial_cost,
        "greedy_cost": greedy_cost,
        "greedy_ms": greedy_ms,
        "aco": aco,
        "optimal_cost": optimal_cost,
        "optimal_ms": optimal_ms,
    }


def _improvement_pct(reference: float, value: float) -> float:
    if reference <= 0:
        return 0.0
    return (reference - value) / reference * 100.0


def _gap_pct(optimal: float, value: float) -> float:
    if optimal <= 0:
        return 0.0
    return (value - optimal) / optimal * 100.0


def format_markdown(results: list[dict[str, Any]]) -> str:
    header = (
        "| Set | n | Inițial (km) | Nearest-neighbor (km) | ACO medie±std (km) | "
        "ACO best (km) | Optim (km) | ACO vs inițial | ACO vs optim | ACO timp (ms) |\n"
        "|---|---|---|---|---|---|---|---|---|---|\n"
    )
    rows = []
    for r in results:
        aco = r["aco"]
        optimal = r["optimal_cost"]
        opt_str = f"{optimal:.2f}" if optimal is not None else "—"
        gap_str = f"+{_gap_pct(optimal, aco['mean']):.1f}%" if optimal is not None else "—"
        rows.append(
            f"| {r['name']} | {r['n']} | {r['initial_cost']:.2f} | {r['greedy_cost']:.2f} | "
            f"{aco['mean']:.2f}±{aco['std']:.2f} | {aco['best']:.2f} | {opt_str} | "
            f"−{_improvement_pct(r['initial_cost'], aco['mean']):.1f}% | {gap_str} | "
            f"{aco['time_ms']:.1f} |"
        )
    return header + "\n".join(rows) + "\n"


def write_csv(results: list[dict[str, Any]], path: Path) -> None:
    import csv

    with path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(
            [
                "set", "n", "initial_cost", "greedy_cost", "greedy_ms",
                "aco_mean", "aco_std", "aco_best", "aco_time_ms",
                "optimal_cost", "optimal_ms",
            ]
        )
        for r in results:
            aco = r["aco"]
            writer.writerow(
                [
                    r["name"], r["n"], f"{r['initial_cost']:.4f}", f"{r['greedy_cost']:.4f}",
                    f"{r['greedy_ms']:.4f}", f"{aco['mean']:.4f}", f"{aco['std']:.4f}",
                    f"{aco['best']:.4f}", f"{aco['time_ms']:.4f}",
                    "" if r["optimal_cost"] is None else f"{r['optimal_cost']:.4f}",
                    "" if r["optimal_ms"] is None else f"{r['optimal_ms']:.4f}",
                ]
            )


def write_convergence_csv(dataset: dict[str, Any], set_def: dict[str, Any], path: Path, seed: int = 0) -> None:
    points = build_points(dataset, set_def["attractionIds"])
    matrix = calculate_distance_matrix(points)
    optimizer = ACOOptimizer(matrix, seed=seed)
    optimizer.optimize()
    import csv

    with path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(["iteration", "best_cost"])
        for iteration, cost in enumerate(optimizer.cost_history, start=1):
            writer.writerow([iteration, f"{cost:.4f}"])


def main() -> None:
    parser = argparse.ArgumentParser(description="Benchmark ACO vs baselines.")
    parser.add_argument("--runs", type=int, default=10, help="ACO repetitions per set (distinct seeds).")
    parser.add_argument("--out-dir", type=Path, default=Path(__file__).resolve().parent / "results")
    args = parser.parse_args()

    dataset = load_dataset()
    args.out_dir.mkdir(parents=True, exist_ok=True)

    results = [evaluate_set(dataset, set_def, args.runs) for set_def in dataset["sets"]]

    markdown = format_markdown(results)
    print(markdown)

    (args.out_dir / "comparison.md").write_text(markdown, encoding="utf-8")
    write_csv(results, args.out_dir / "comparison.csv")
    write_convergence_csv(dataset, dataset["sets"][-1], args.out_dir / "convergence.csv")

    print(f"Results written to {args.out_dir}/ (comparison.md, comparison.csv, convergence.csv)")


if __name__ == "__main__":
    main()
