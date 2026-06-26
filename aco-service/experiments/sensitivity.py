"""Parameter sensitivity study for the ACO optimizer.

Sweeps alpha, beta and rho one at a time (others held at the defaults
alpha=1, beta=2, rho=0.5) and measures solution quality as the mean gap to the
exact optimum across the benchmark sets where brute force is feasible (n<=12).
Also dumps convergence histories for the default configuration.

All matrices are the real OSRM driving durations cached by ``osrm_bench.py``;
run that first (or it falls back to fetching). Output: CSVs in results/ that
feed the pgfplots figures in the thesis.

Usage:
    .venv/bin/python -m experiments.sensitivity --runs 10
"""
from __future__ import annotations

import argparse
import csv
import json
import logging
import statistics
from pathlib import Path
from typing import Any

from app.algorithms.aco import ALPHA, BETA, RHO, ACOOptimizer
from app.algorithms.brute_force import DEFAULT_MAX_POINTS, brute_force

logging.disable(logging.CRITICAL)  # silence per-run ACO logs

RESULTS_DIR = Path(__file__).resolve().parent / "results"
MATRIX_CACHE = RESULTS_DIR / "osrm_matrices.json"
PROFILE = "driving"

ALPHA_VALUES = [0.0, 0.5, 1.0, 2.0, 3.0, 5.0]
BETA_VALUES = [0.0, 1.0, 2.0, 3.0, 5.0]
RHO_VALUES = [0.1, 0.3, 0.5, 0.7, 0.9]

CONVERGENCE_SETS = ("medium-11", "large-15")


def load_matrices() -> dict[str, Any]:
    if not MATRIX_CACHE.exists():
        raise SystemExit("Run `python -m experiments.osrm_bench` first to build the OSRM matrix cache.")
    cache = json.loads(MATRIX_CACHE.read_text(encoding="utf-8"))
    return cache["profiles"][PROFILE]


def optimal_costs(per_set: dict[str, Any]) -> dict[str, float]:
    """Exact optimum (brute force) per set where n<=12, on the duration matrix."""
    optima: dict[str, float] = {}
    for name, entry in per_set.items():
        if entry["n"] <= DEFAULT_MAX_POINTS:
            _, cost = brute_force(entry["durations"])
            optima[name] = cost
    return optima


def mean_gap(per_set: dict[str, Any], optima: dict[str, float], runs: int, **params: float) -> tuple[float, float]:
    """Mean gap-to-optimum (%) over the sets with a known optimum, plus its std across sets."""
    set_gaps: list[float] = []
    for name, optimal in optima.items():
        matrix = per_set[name]["durations"]
        costs = [ACOOptimizer(matrix, seed=s, **params).optimize()[1] for s in range(runs)]
        mean_cost = statistics.fmean(costs)
        set_gaps.append((mean_cost - optimal) / optimal * 100.0 if optimal > 0 else 0.0)
    return statistics.fmean(set_gaps), (statistics.pstdev(set_gaps) if len(set_gaps) > 1 else 0.0)


def sweep(per_set: dict[str, Any], optima: dict[str, float], runs: int,
          param: str, values: list[float], defaults: dict[str, float]) -> list[dict[str, float]]:
    rows = []
    for value in values:
        params = {**defaults, param: value}
        gap_mean, gap_std = mean_gap(per_set, optima, runs, **params)
        rows.append({"value": value, "gap_mean": gap_mean, "gap_std": gap_std})
        print(f"  {param}={value:<4} -> gap {gap_mean:5.2f}% (±{gap_std:.2f} between sets)")
    return rows


def write_sweep_csv(param: str, rows: list[dict[str, float]]) -> None:
    path = RESULTS_DIR / f"sensitivity_{param}.csv"
    with path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow([param, "gap_mean", "gap_std"])
        for r in rows:
            writer.writerow([f"{r['value']:g}", f"{r['gap_mean']:.4f}", f"{r['gap_std']:.4f}"])


def write_convergence_csv(per_set: dict[str, Any]) -> None:
    """Normalized convergence (best cost / final best) per iteration, default config."""
    histories: dict[str, list[float]] = {}
    for name in CONVERGENCE_SETS:
        optimizer = ACOOptimizer(per_set[name]["durations"], seed=0)
        optimizer.optimize()
        history = optimizer.cost_history
        final = history[-1] if history else 1.0
        histories[name] = [c / final for c in history] if final > 0 else history

    max_len = max((len(h) for h in histories.values()), default=0)
    path = RESULTS_DIR / "convergence_osrm.csv"
    with path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(["iteration", *CONVERGENCE_SETS])
        for i in range(max_len):
            row = [i + 1]
            for name in CONVERGENCE_SETS:
                hist = histories[name]
                row.append(f"{hist[i]:.5f}" if i < len(hist) else "")
            writer.writerow(row)


def main() -> None:
    parser = argparse.ArgumentParser(description="ACO parameter sensitivity study.")
    parser.add_argument("--runs", type=int, default=10)
    args = parser.parse_args()

    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    per_set = load_matrices()
    optima = optimal_costs(per_set)
    print(f"Sets with exact optimum (n<=12): {', '.join(optima)}")

    defaults = {"alpha": ALPHA, "beta": BETA, "rho": RHO}
    for param, values in (("alpha", ALPHA_VALUES), ("beta", BETA_VALUES), ("rho", RHO_VALUES)):
        print(f"\nSweeping {param} (others at defaults α={ALPHA}, β={BETA}, ρ={RHO}):")
        rows = sweep(per_set, optima, args.runs, param, values, defaults)
        write_sweep_csv(param, rows)

    write_convergence_csv(per_set)
    print(f"\nResults written to {RESULTS_DIR}/ (sensitivity_*.csv, convergence_osrm.csv)")


if __name__ == "__main__":
    main()
