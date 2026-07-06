"""Orienteering benchmark: score collected under a time budget.

The OP variant answers a different question than the TSP benchmarks: not "how
short is the route" but "how much prize fits into the tourist's time". This
script builds synthetic guide-tour instances around Cluj (random points in the
same bounding box as scaling_bench, walking-time costs at 5 km/h, per-node visit
durations) and compares, at several budget levels:

  * greedy      -- deterministic score-per-minute baseline;
  * ACO-OP      -- the orienteering ant colony (mean +/- std over N seeds);
  * exact       -- DFS optimum, only on small instances (n <= 10).

Budgets are expressed as fractions of the full-visit time (NN route + all visit
durations), so "50%" always means "you have half the time needed to see it all".
"""
from __future__ import annotations

import argparse
import csv
import random
import statistics
import time
from pathlib import Path
from typing import Any

from app.algorithms.nearest_neighbor import nearest_neighbor
from app.algorithms.orienteering import (
    OrienteeringACO,
    brute_force_orienteering,
    greedy_orienteering,
    route_time,
)
from app.common.distance import calculate_distance_matrix

# Same Cluj-Napoca box and anchor as scaling_bench.py.
START = {"latitude": 46.7726428, "longitude": 23.5852436}
LAT_RANGE = (46.72, 46.82)
LON_RANGE = (23.53, 23.66)

WALK_MIN_PER_KM = 12.0          # 5 km/h -> minutes per km, so budgets read as minutes
SCORE_RANGE = (1.0, 10.0)       # per-attraction prize (stands in for importance_score)
SERVICE_RANGE = (10.0, 40.0)    # per-attraction visit duration, minutes

SMALL_SIZES = [8, 10]           # exact optimum still feasible
LARGE_SIZES = [15, 20, 30]      # realistic guide-tour candidate lists
BUDGET_FRACTIONS = [0.25, 0.50, 0.75]
INSTANCE_SEED = 20260703        # fixed so instances are reproducible
RUNS = 10                       # seeds for ACO-OP
EXACT_MAX_POINTS = 10


def build_instance(total_nodes: int, seed: int) -> tuple[list[list[float]], list[float], list[float]]:
    """Walking-minutes matrix + scores + visit durations for one synthetic tour."""
    rng = random.Random(seed)
    points = [START]
    for _ in range(total_nodes - 1):
        points.append({"latitude": rng.uniform(*LAT_RANGE), "longitude": rng.uniform(*LON_RANGE)})
    matrix = [
        [km * WALK_MIN_PER_KM for km in row]
        for row in calculate_distance_matrix(points)
    ]
    scores = [0.0] + [rng.uniform(*SCORE_RANGE) for _ in range(total_nodes - 1)]
    service = [0.0] + [rng.uniform(*SERVICE_RANGE) for _ in range(total_nodes - 1)]
    return matrix, scores, service


def full_visit_time(matrix: list[list[float]], service: list[float]) -> float:
    # Time to see EVERYTHING: NN route (a sane visiting order) + every visit.
    nn_route, _ = nearest_neighbor(matrix)
    return route_time(nn_route, matrix, service)


def evaluate(total_nodes: int, fraction: float, runs: int) -> dict[str, Any]:
    matrix, scores, service = build_instance(total_nodes, INSTANCE_SEED)
    budget = full_visit_time(matrix, service) * fraction
    total_score = sum(scores)

    greedy_route, greedy_score = greedy_orienteering(matrix, scores, budget, service)

    aco_scores: list[float] = []
    aco_stops: list[int] = []
    times_ms: list[float] = []
    for seed in range(runs):
        started = time.perf_counter()
        route, score = OrienteeringACO(
            matrix, scores, budget, seed=seed, service_times=service
        ).optimize()
        times_ms.append((time.perf_counter() - started) * 1000.0)
        aco_scores.append(score)
        aco_stops.append(len(route) - 1)

    exact_score: float | None = None
    if total_nodes <= EXACT_MAX_POINTS:
        _, exact_score = brute_force_orienteering(
            matrix, scores, budget, service, max_points=EXACT_MAX_POINTS
        )

    return {
        "n": total_nodes,
        "fraction": fraction,
        "budget": budget,
        "total_score": total_score,
        "greedy": {"score": greedy_score, "stops": len(greedy_route) - 1},
        "aco": {
            "mean": statistics.fmean(aco_scores),
            "std": statistics.pstdev(aco_scores) if len(aco_scores) > 1 else 0.0,
            "best": max(aco_scores),
            "stops": statistics.fmean(aco_stops),
            "time_ms": statistics.fmean(times_ms),
        },
        "exact": exact_score,
    }


def format_markdown(rows: list[dict[str, Any]]) -> str:
    head = (
        "| n | buget | greedy | ACO-OP medie±std | optim | ACO vs greedy | gap vs optim | opriri ACO | ms |\n"
        "|---|---|---|---|---|---|---|---|---|\n"
    )
    lines = []
    for r in rows:
        greedy = r["greedy"]["score"]
        aco_mean = r["aco"]["mean"]
        vs_greedy = 0.0 if greedy <= 0 else (aco_mean - greedy) / greedy * 100.0
        if r["exact"] is not None and r["exact"] > 0:
            gap = (r["exact"] - aco_mean) / r["exact"] * 100.0
            exact_txt, gap_txt = f"{r['exact']:.2f}", f"{gap:.1f}%"
        else:
            exact_txt, gap_txt = "---", "---"
        lines.append(
            f"| {r['n']} | {int(r['fraction'] * 100)}% ({r['budget']:.0f} min) | {greedy:.2f} | "
            f"{aco_mean:.2f}±{r['aco']['std']:.2f} | {exact_txt} | "
            f"{vs_greedy:+.1f}% | {gap_txt} | {r['aco']['stops']:.1f} | {r['aco']['time_ms']:.0f} |"
        )
    return head + "\n".join(lines) + "\n"


def write_csv(rows: list[dict[str, Any]], path: Path) -> None:
    with path.open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(
            ["n", "fraction", "budget_min", "total_score",
             "greedy_score", "greedy_stops",
             "aco_mean", "aco_std", "aco_best", "aco_stops", "aco_ms",
             "exact_score"]
        )
        for r in rows:
            w.writerow(
                [r["n"], r["fraction"], f"{r['budget']:.2f}", f"{r['total_score']:.2f}",
                 f"{r['greedy']['score']:.4f}", r["greedy"]["stops"],
                 f"{r['aco']['mean']:.4f}", f"{r['aco']['std']:.4f}", f"{r['aco']['best']:.4f}",
                 f"{r['aco']['stops']:.2f}", f"{r['aco']['time_ms']:.2f}",
                 "" if r["exact"] is None else f"{r['exact']:.4f}"]
            )


def main() -> None:
    parser = argparse.ArgumentParser(description="Orienteering benchmark on synthetic tours.")
    parser.add_argument("--runs", type=int, default=RUNS)
    parser.add_argument("--out-dir", type=Path, default=Path(__file__).resolve().parent / "results")
    args = parser.parse_args()

    args.out_dir.mkdir(parents=True, exist_ok=True)
    rows = [
        evaluate(n, fraction, args.runs)
        for n in SMALL_SIZES + LARGE_SIZES
        for fraction in BUDGET_FRACTIONS
    ]

    md = format_markdown(rows)
    print(md)
    (args.out_dir / "orienteering.md").write_text(md, encoding="utf-8")
    write_csv(rows, args.out_dir / "orienteering.csv")
    print(f"Written to {args.out_dir}/ (orienteering.md, orienteering.csv)")


if __name__ == "__main__":
    main()
