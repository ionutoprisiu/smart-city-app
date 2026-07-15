"""Fair (symmetric) ACO vs PSO comparison via train/test calibration.

The main benchmark runs PSO on default parameters, which the thesis flags as an
asymmetric comparison. This script removes that caveat: it grid-searches the
parameters of BOTH algorithms on a TRAIN set of synthetic instances, fixes each
one's best configuration, and compares them on a disjoint TEST set (instances
unseen during calibration). A paired Wilcoxon test (reused from robustness_bench)
answers: after a fair calibration, does ACO still beat PSO?

Pure Python + Haversine, reproducible without scipy/numpy/OSRM.
"""
from __future__ import annotations

import argparse
import itertools
import statistics
import time
from pathlib import Path
from typing import Any, Callable

from app.algorithms.aco import ACOOptimizer
from app.algorithms.pso import PSOOptimizer
from experiments.robustness_bench import synthetic_matrix, wilcoxon_signed_rank

SIZES = [30, 50]
K_TRAIN = 5              # instances used only to pick parameters
K_TEST = 6              # disjoint instances used only to report performance
RUNS_CAL = 5           # seeds per instance during calibration
RUNS_TEST = 10         # seeds per instance during final evaluation
TRAIN_SEED_BASE = 11000
TEST_SEED_BASE = 99000  # disjoint from train so test instances are never seen

# Canonical / default configurations (what the main benchmark uses today).
ACO_DEFAULT = {"alpha": 1.0, "beta": 2.0, "rho": 0.5}
PSO_DEFAULT = {"swarm_size": 30, "inertia": 0.7, "cognitive": 1.5, "social": 1.5}

# Symmetric grids: each algorithm gets the same calibration effort.
ACO_GRID = [
    {"alpha": a, "beta": b, "rho": r}
    for a, b, r in itertools.product((0.5, 1.0, 2.0), (2.0, 3.0, 4.0), (0.3, 0.5))
]
PSO_GRID = [
    {"swarm_size": s, "inertia": w, "cognitive": c, "social": c}
    for s, w, c in itertools.product((30, 50), (0.4, 0.7, 0.9), (1.5, 2.0))
]


def aco_cost(matrix: list[list[float]], p: dict[str, Any], seed: int) -> float:
    return ACOOptimizer(matrix, seed=seed, alpha=p["alpha"], beta=p["beta"], rho=p["rho"]).optimize()[1]


def pso_cost(matrix: list[list[float]], p: dict[str, Any], seed: int) -> float:
    return PSOOptimizer(
        matrix, seed=seed, swarm_size=p["swarm_size"],
        inertia=p["inertia"], cognitive=p["cognitive"], social=p["social"],
    ).optimize()[1]


def _instance_mean(matrix: list[list[float]], p: dict[str, Any], runs: int,
                   cost_fn: Callable[..., float]) -> float:
    return statistics.fmean(cost_fn(matrix, p, s) for s in range(runs))


def calibrate(grid: list[dict], train: list[list[list[float]]], runs: int,
              cost_fn: Callable[..., float]) -> tuple[dict, float]:
    best_params, best_cost = grid[0], float("inf")
    for p in grid:
        # Mean over all train instances and seeds -> a single score for this config.
        score = statistics.fmean(_instance_mean(m, p, runs, cost_fn) for m in train)
        if score < best_cost:
            best_params, best_cost = p, score
    return best_params, best_cost


def per_instance_means(test: list[list[list[float]]], p: dict[str, Any], runs: int,
                       cost_fn: Callable[..., float]) -> list[float]:
    return [_instance_mean(m, p, runs, cost_fn) for m in test]


def evaluate_size(n: int) -> dict[str, Any]:
    train = [synthetic_matrix(n, TRAIN_SEED_BASE + i * 7 + n) for i in range(K_TRAIN)]
    test = [synthetic_matrix(n, TEST_SEED_BASE + i * 7 + n) for i in range(K_TEST)]

    aco_best, _ = calibrate(ACO_GRID, train, RUNS_CAL, aco_cost)
    pso_best, _ = calibrate(PSO_GRID, train, RUNS_CAL, pso_cost)

    # Final, honest evaluation on unseen test instances.
    aco_def = per_instance_means(test, ACO_DEFAULT, RUNS_TEST, aco_cost)
    aco_tun = per_instance_means(test, aco_best, RUNS_TEST, aco_cost)
    pso_def = per_instance_means(test, PSO_DEFAULT, RUNS_TEST, pso_cost)
    pso_tun = per_instance_means(test, pso_best, RUNS_TEST, pso_cost)

    # Paired test on TEST instances: tuned ACO vs tuned PSO (diff>0 => ACO shorter).
    diffs = [pt - at for at, pt in zip(aco_tun, pso_tun)]
    wil = wilcoxon_signed_rank(diffs)
    aco_wins = sum(1 for at, pt in zip(aco_tun, pso_tun) if at <= pt + 1e-9)

    def ms(v: list[float]) -> tuple[float, float]:
        return statistics.fmean(v), (statistics.pstdev(v) if len(v) > 1 else 0.0)

    pso_gain = 0.0
    if statistics.fmean(pso_def) > 0:
        pso_gain = (statistics.fmean(pso_def) - statistics.fmean(pso_tun)) / statistics.fmean(pso_def) * 100.0
    aco_vs_pso = 0.0
    if statistics.fmean(pso_tun) > 0:
        aco_vs_pso = (statistics.fmean(pso_tun) - statistics.fmean(aco_tun)) / statistics.fmean(pso_tun) * 100.0

    return {
        "n": n, "k_train": K_TRAIN, "k_test": K_TEST,
        "aco_best": aco_best, "pso_best": pso_best,
        "aco_def_ms": ms(aco_def), "aco_tun_ms": ms(aco_tun),
        "pso_def_ms": ms(pso_def), "pso_tun_ms": ms(pso_tun),
        "pso_calibration_gain_pct": pso_gain,
        "aco_vs_pso_tuned_pct": aco_vs_pso,
        "aco_wins": aco_wins, "wilcoxon": wil,
    }


def format_report(rows: list[dict[str, Any]]) -> str:
    out = ["## Comparație corectă ACO vs PSO — calibrare simetrică train/test\n"]
    out.append(f"Calibrare pe {K_TRAIN} instanțe (train, {RUNS_CAL} seed-uri), "
               f"evaluare pe {K_TEST} instanțe disjuncte (test, {RUNS_TEST} seed-uri).\n")
    out.append("| n | PSO implicit | PSO calibrat | ACO implicit | ACO calibrat | ACO vs PSO (calibrați) | ACO câștig | Wilcoxon p |")
    out.append("|---|---|---|---|---|---|---|---|")
    for r in rows:
        out.append(
            f"| {r['n']} | {r['pso_def_ms'][0]:.2f}±{r['pso_def_ms'][1]:.2f} | "
            f"{r['pso_tun_ms'][0]:.2f}±{r['pso_tun_ms'][1]:.2f} | "
            f"{r['aco_def_ms'][0]:.2f}±{r['aco_def_ms'][1]:.2f} | "
            f"{r['aco_tun_ms'][0]:.2f}±{r['aco_tun_ms'][1]:.2f} | "
            f"−{r['aco_vs_pso_tuned_pct']:.1f}% | {r['aco_wins']}/{r['k_test']} | "
            f"{r['wilcoxon']['p']:.4f} |"
        )
    out.append("")
    for r in rows:
        w = r["wilcoxon"]
        sig = "semnificativ (p<0.05)" if w["p"] < 0.05 else "NEsemnificativ"
        out.append(
            f"- n={r['n']}: PSO calibrat = {r['pso_best']} (câștig calibrare {r['pso_calibration_gain_pct']:+.1f}% vs implicit); "
            f"ACO calibrat = {r['aco_best']}. "
            f"ACO calibrat e cu {r['aco_vs_pso_tuned_pct']:.1f}% mai scurt decât PSO calibrat, "
            f"câștig {r['aco_wins']}/{r['k_test']} instanțe test, Wilcoxon p={w['p']:.4f} → {sig}"
        )
    return "\n".join(out) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description="Symmetric ACO vs PSO calibration benchmark.")
    parser.add_argument("--sizes", type=int, nargs="+", default=SIZES)
    parser.add_argument("--out-dir", type=Path, default=Path(__file__).resolve().parent / "results")
    args = parser.parse_args()

    args.out_dir.mkdir(parents=True, exist_ok=True)
    t0 = time.perf_counter()
    rows = [evaluate_size(n) for n in args.sizes]
    elapsed = time.perf_counter() - t0

    report = format_report(rows)
    print(report)
    print(f"(total {elapsed:.1f}s)")
    (args.out_dir / "pso_calibration.md").write_text(report, encoding="utf-8")
    print(f"Written to {args.out_dir}/pso_calibration.md")


if __name__ == "__main__":
    main()
