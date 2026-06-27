"""ACO vs PSO vs nearest-neighbor comparison and runtime scaling.

Runs on the cached OSRM driving-duration matrices (build them first with
``osrm_bench.py``). Reports, per benchmark set, the mean +/- std travel time of
ACO and PSO over distinct seeds against nearest-neighbor and the exact optimum,
plus the average ACO/PSO runtime per problem size. Output CSVs feed the thesis.

Usage:
    .venv/bin/python -m experiments.compare_algorithms --runs 10
"""
from __future__ import annotations

import argparse
import csv
import json
import logging
import statistics
import time
from pathlib import Path
from typing import Any

from app.algorithms.aco import ACOOptimizer
from app.algorithms.brute_force import DEFAULT_MAX_POINTS, brute_force
from app.algorithms.nearest_neighbor import nearest_neighbor
from app.algorithms.pso import PSOOptimizer

logging.disable(logging.CRITICAL)

RESULTS_DIR = Path(__file__).resolve().parent / "results"
MATRIX_CACHE = RESULTS_DIR / "osrm_matrices.json"
PROFILE = "driving"


def load_matrices() -> dict[str, Any]:
    if not MATRIX_CACHE.exists():
        raise SystemExit("Run `python -m experiments.osrm_bench` first to build the OSRM matrix cache.")
    return json.loads(MATRIX_CACHE.read_text(encoding="utf-8"))["profiles"][PROFILE]


def _run(optimizer_cls, matrix: list[list[float]], runs: int) -> dict[str, float]:
    costs: list[float] = []
    times_ms: list[float] = []
    for seed in range(runs):
        start = time.perf_counter()
        _, cost = optimizer_cls(matrix, seed=seed).optimize()
        times_ms.append((time.perf_counter() - start) * 1000.0)
        costs.append(cost)
    return {
        "mean": statistics.fmean(costs),
        "std": statistics.pstdev(costs) if len(costs) > 1 else 0.0,
        "time_ms": statistics.fmean(times_ms),
    }


def _gap(optimal: float | None, value: float) -> float | None:
    if optimal is None or optimal <= 0:
        return None
    return (value - optimal) / optimal * 100.0


def evaluate(per_set: dict[str, Any], names: list[str], runs: int) -> list[dict[str, Any]]:
    rows = []
    for name in names:
        entry = per_set[name]
        matrix = entry["durations"]
        n = entry["n"]

        _, nn_cost = nearest_neighbor(matrix)
        aco = _run(ACOOptimizer, matrix, runs)
        pso = _run(PSOOptimizer, matrix, runs)
        optimal = brute_force(matrix)[1] if n <= DEFAULT_MAX_POINTS else None

        rows.append({
            "name": name, "n": n,
            "nn_min": nn_cost / 60.0,
            "aco_min": aco["mean"] / 60.0, "aco_std": aco["std"] / 60.0, "aco_ms": aco["time_ms"],
            "pso_min": pso["mean"] / 60.0, "pso_std": pso["std"] / 60.0, "pso_ms": pso["time_ms"],
            "optimal_min": None if optimal is None else optimal / 60.0,
            "aco_gap": _gap(optimal, aco["mean"]),
            "pso_gap": _gap(optimal, pso["mean"]),
        })
    return rows


def write_compare_csv(rows: list[dict[str, Any]]) -> None:
    path = RESULTS_DIR / "algo_compare.csv"
    with path.open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["set", "n", "nn_min", "aco_mean_min", "aco_std_min", "pso_mean_min",
                    "pso_std_min", "optimal_min", "aco_gap_pct", "pso_gap_pct"])
        for r in rows:
            w.writerow([
                r["name"], r["n"], f"{r['nn_min']:.3f}", f"{r['aco_min']:.3f}", f"{r['aco_std']:.3f}",
                f"{r['pso_min']:.3f}", f"{r['pso_std']:.3f}",
                "" if r["optimal_min"] is None else f"{r['optimal_min']:.3f}",
                "" if r["aco_gap"] is None else f"{r['aco_gap']:.2f}",
                "" if r["pso_gap"] is None else f"{r['pso_gap']:.2f}",
            ])


def write_runtime_csv(rows: list[dict[str, Any]]) -> None:
    path = RESULTS_DIR / "runtime.csv"
    with path.open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["n", "aco_ms", "pso_ms"])
        for r in rows:
            w.writerow([r["n"], f"{r['aco_ms']:.2f}", f"{r['pso_ms']:.2f}"])


def print_table(rows: list[dict[str, Any]]) -> None:
    print(f"{'set':10} {'n':>2}  {'NN':>6} {'ACO':>14} {'PSO':>14} {'opt':>6}  {'ACO gap':>8} {'PSO gap':>8}")
    for r in rows:
        opt = "—" if r["optimal_min"] is None else f"{r['optimal_min']:.1f}"
        ag = "—" if r["aco_gap"] is None else f"+{r['aco_gap']:.1f}%"
        pg = "—" if r["pso_gap"] is None else f"+{r['pso_gap']:.1f}%"
        print(f"{r['name']:10} {r['n']:>2}  {r['nn_min']:6.1f} "
              f"{r['aco_min']:6.1f}±{r['aco_std']:.2f} {r['pso_min']:6.1f}±{r['pso_std']:.2f} "
              f"{opt:>6}  {ag:>8} {pg:>8}  (ACO {r['aco_ms']:.1f}ms, PSO {r['pso_ms']:.1f}ms)")


def main() -> None:
    parser = argparse.ArgumentParser(description="ACO vs PSO comparison + runtime.")
    parser.add_argument("--runs", type=int, default=10)
    args = parser.parse_args()

    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    per_set = load_matrices()
    names = ["small-5", "medium-8", "medium-9", "medium-10", "medium-11", "large-12", "large-15"]
    names = [n for n in names if n in per_set]

    rows = evaluate(per_set, names, args.runs)
    print_table(rows)
    write_compare_csv(rows)
    write_runtime_csv(rows)
    print(f"\nResults written to {RESULTS_DIR}/ (algo_compare.csv, runtime.csv)")


if __name__ == "__main__":
    main()
