"""Orienteering benchmark on REAL OSRM travel times.

The Haversine OP benchmark (``op_bench.py``) validates ACO-OP quickly and
reproducibly on synthetic instances. This script closes the gap with the TSP
evaluation by running the SAME Orienteering comparison (greedy vs. ACO-OP vs.
exact) on the real OSRM duration matrices of the fixed Cluj-Napoca benchmark
sets — exactly the street-level cost the production Tururi flow minimizes.

Travel time comes from OSRM (seconds -> minutes); per-attraction scores and
visit durations are assigned deterministically (seeded, stable per attraction)
so the instance is fully reproducible. Reuses the matrix cache written by
``osrm_bench.py`` (``results/osrm_matrices.json``).

Usage:
    .venv/bin/python -m experiments.op_osrm_bench --runs 10
    .venv/bin/python -m experiments.op_osrm_bench --foot-url http://localhost:5010 \
        --driving-url http://localhost:5011   # to (re)fetch matrices
"""
from __future__ import annotations

import argparse
import csv
import json
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

# Reuse osrm_bench's dataset + matrix cache so both benchmarks share instances.
from experiments.osrm_bench import (
    DATA_FILE,
    MATRIX_CACHE,
    PROFILES,
    RESULTS_DIR,
    build_matrix_cache,
    load_dataset,
)

SCORE_RANGE = (1.0, 10.0)       # per-attraction prize (stands in for importance_score)
SERVICE_RANGE = (10.0, 40.0)    # per-attraction visit duration, minutes
BUDGET_FRACTIONS = [0.25, 0.50, 0.75]
INSTANCE_SEED = 20260703        # same seed family as the Haversine OP benchmark
RUNS = 10
EXACT_MAX_POINTS = 10


def assign_attributes(dataset: dict[str, Any]) -> tuple[dict[int, float], dict[int, float]]:
    """Deterministic score + visit duration per attraction id (stable across sets)."""
    rng = random.Random(INSTANCE_SEED)
    scores: dict[int, float] = {}
    durations: dict[int, float] = {}
    for item in sorted(dataset["pool"], key=lambda it: it["id"]):
        scores[item["id"]] = rng.uniform(*SCORE_RANGE)
        durations[item["id"]] = rng.uniform(*SERVICE_RANGE)
    return scores, durations


def minutes_matrix(durations_sec: list[list[float]]) -> list[list[float]]:
    return [[v / 60.0 for v in row] for row in durations_sec]


def evaluate(
    set_def: dict[str, Any],
    entry: dict[str, Any],
    score_by_id: dict[int, float],
    dur_by_id: dict[int, float],
    fraction: float,
    runs: int,
) -> dict[str, Any]:
    matrix = minutes_matrix(entry["durations"])  # OSRM seconds -> minutes
    # Index 0 is the start anchor; 1..n follow the set's attractionIds order.
    scores = [0.0] + [score_by_id[aid] for aid in set_def["attractionIds"]]
    service = [0.0] + [dur_by_id[aid] for aid in set_def["attractionIds"]]
    total_score = sum(scores)

    nn_route, _ = nearest_neighbor(matrix)
    budget = route_time(nn_route, matrix, service) * fraction

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
    if entry["n"] <= EXACT_MAX_POINTS:
        _, exact_score = brute_force_orienteering(
            matrix, scores, budget, service, max_points=EXACT_MAX_POINTS
        )

    return {
        "name": set_def["name"],
        "n": entry["n"],
        "fraction": fraction,
        "budget": budget,
        "total_score": total_score,
        "greedy": greedy_score,
        "aco_mean": statistics.fmean(aco_scores),
        "aco_std": statistics.pstdev(aco_scores) if len(aco_scores) > 1 else 0.0,
        "aco_stops": statistics.fmean(aco_stops),
        "aco_time_ms": statistics.fmean(times_ms),
        "exact": exact_score,
    }


def format_markdown(profile: str, rows: list[dict[str, Any]]) -> str:
    header = (
        f"\n### Profil {profile} — Orienteering pe durate reale OSRM\n\n"
        "| Set | n | Buget | Greedy | ACO-OP medie±std | Optim | ACO vs greedy | gap vs optim | opriri |\n"
        "|---|---|---|---|---|---|---|---|---|\n"
    )
    lines = []
    for r in rows:
        greedy = r["greedy"]
        aco = r["aco_mean"]
        vs_greedy = 0.0 if greedy <= 0 else (aco - greedy) / greedy * 100.0
        if r["exact"] is not None and r["exact"] > 0:
            gap = (r["exact"] - aco) / r["exact"] * 100.0
            exact_str, gap_str = f"{r['exact']:.2f}", f"{gap:.1f}%"
        else:
            exact_str, gap_str = "—", "—"
        lines.append(
            f"| {r['name']} | {r['n']} | {int(r['fraction'] * 100)}% ({r['budget']:.0f}m) | "
            f"{greedy:.2f} | {aco:.2f}±{r['aco_std']:.2f} | {exact_str} | "
            f"{vs_greedy:+.1f}% | {gap_str} | {r['aco_stops']:.1f} |"
        )
    return header + "\n".join(lines) + "\n"


def write_csv(profile: str, rows: list[dict[str, Any]], path: Path) -> None:
    with path.open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow([
            "set", "n", "fraction", "budget_min", "total_score",
            "greedy_score", "aco_mean", "aco_std", "aco_stops", "aco_time_ms", "exact_score",
        ])
        for r in rows:
            w.writerow([
                r["name"], r["n"], r["fraction"], f"{r['budget']:.2f}", f"{r['total_score']:.2f}",
                f"{r['greedy']:.4f}", f"{r['aco_mean']:.4f}", f"{r['aco_std']:.4f}",
                f"{r['aco_stops']:.2f}", f"{r['aco_time_ms']:.2f}",
                "" if r["exact"] is None else f"{r['exact']:.4f}",
            ])


def main() -> None:
    parser = argparse.ArgumentParser(description="Orienteering benchmark on real OSRM times.")
    parser.add_argument("--runs", type=int, default=RUNS)
    parser.add_argument("--foot-url", default="http://localhost:5010")
    parser.add_argument("--driving-url", default="http://localhost:5011")
    parser.add_argument("--use-cache", action="store_true", help="Reuse cached OSRM matrices.")
    args = parser.parse_args()

    dataset = load_dataset(DATA_FILE)
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    if args.use_cache and MATRIX_CACHE.exists():
        cache = json.loads(MATRIX_CACHE.read_text(encoding="utf-8"))
        print("Using cached OSRM matrices.")
    elif MATRIX_CACHE.exists():
        cache = json.loads(MATRIX_CACHE.read_text(encoding="utf-8"))
        print("Using cached OSRM matrices (present).")
    else:
        print("Fetching OSRM matrices...")
        cache = build_matrix_cache(dataset, {"foot": args.foot_url, "driving": args.driving_url})

    score_by_id, dur_by_id = assign_attributes(dataset)

    full_md = "# Benchmark Orienteering pe durate reale OSRM (Cluj-Napoca)\n"
    for profile in PROFILES:
        per_set = cache["profiles"][profile]
        rows = [
            evaluate(s, per_set[s["name"]], score_by_id, dur_by_id, frac, args.runs)
            for s in dataset["sets"]
            for frac in BUDGET_FRACTIONS
        ]
        md = format_markdown(profile, rows)
        print(md)
        full_md += md
        write_csv(profile, rows, RESULTS_DIR / f"op_osrm_{profile}.csv")

    (RESULTS_DIR / "op_osrm.md").write_text(full_md, encoding="utf-8")
    print(f"Written to {RESULTS_DIR}/ (op_osrm.md, op_osrm_foot.csv, op_osrm_driving.csv)")


if __name__ == "__main__":
    main()
