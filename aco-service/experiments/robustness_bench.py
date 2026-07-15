"""Multi-instance robustness benchmark: are the ranking gaps statistically real?

The single-instance scaling benchmark (`scaling_bench.py`) reports one synthetic
instance per size, so a per-size ranking is anecdotal (the `large-15` anomaly is
proof). This script closes that gap: it draws K independent random instances per
size, runs each algorithm on all of them, and applies a PAIRED nonparametric test
(Wilcoxon signed-rank, normal approximation) to the key comparison ACO+2-opt vs.
NN+2-opt across instances.

Deterministic methods (NN, NN+2-opt) give one value per instance; stochastic ones
(ACO, ACO+2-opt, PSO) are averaged over N seeds per instance. Everything is pure
Python + Haversine, so it reproduces without scipy/numpy/OSRM.
"""
from __future__ import annotations

import argparse
import csv
import math
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

START = {"latitude": 46.7726428, "longitude": 23.5852436}
LAT_RANGE = (46.72, 46.82)
LON_RANGE = (23.53, 23.66)

SIZES = [30, 50, 100]
K_INSTANCES = 12          # independent random instances per size
RUNS = 10                 # seeds per stochastic algorithm, per instance
INSTANCE_SEED_BASE = 20260707


def synthetic_matrix(total_nodes: int, seed: int) -> list[list[float]]:
    rng = random.Random(seed)
    points = [START]
    for _ in range(total_nodes - 1):
        points.append(
            {"latitude": rng.uniform(*LAT_RANGE), "longitude": rng.uniform(*LON_RANGE)}
        )
    return calculate_distance_matrix(points)


def _stochastic_mean(make: Callable[[int], tuple[list[int], float]],
                     matrix: list[list[float]], runs: int, *, refine: bool) -> float:
    costs: list[float] = []
    for seed in range(runs):
        route, cost = make(seed)
        if refine:
            _, cost = two_opt(matrix, route)
        costs.append(cost)
    return statistics.fmean(costs)


def _norm_cdf(x: float) -> float:
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))


def wilcoxon_signed_rank(diffs: list[float]) -> dict[str, float]:
    """Paired Wilcoxon signed-rank test (normal approximation, continuity- and
    tie-corrected). `diffs` are paired differences; zeros are dropped. Returns the
    statistic W, the z-score and the two-sided p-value."""
    nonzero = [d for d in diffs if d != 0.0]
    n = len(nonzero)
    if n == 0:
        return {"n": 0, "w": 0.0, "z": 0.0, "p": 1.0}

    order = sorted(range(n), key=lambda i: abs(nonzero[i]))
    ranks = [0.0] * n
    i = 0
    tie_terms = 0.0
    while i < n:
        j = i
        while j + 1 < n and abs(nonzero[order[j + 1]]) == abs(nonzero[order[i]]):
            j += 1
        avg_rank = (i + 1 + j + 1) / 2.0  # average of 1-based ranks in the tie group
        group = j - i + 1
        tie_terms += group ** 3 - group
        for k in range(i, j + 1):
            ranks[order[k]] = avg_rank
        i = j + 1

    w_plus = sum(ranks[i] for i in range(n) if nonzero[i] > 0)
    w_minus = sum(ranks[i] for i in range(n) if nonzero[i] < 0)
    w = min(w_plus, w_minus)

    mean_w = n * (n + 1) / 4.0
    var_w = (n * (n + 1) * (2 * n + 1) - tie_terms / 2.0) / 24.0
    if var_w <= 0:
        return {"n": n, "w": w, "z": 0.0, "p": 1.0}
    z = (w - mean_w + 0.5) / math.sqrt(var_w)  # continuity correction toward the mean
    p = 2.0 * _norm_cdf(-abs(z))
    return {"n": n, "w": w, "z": z, "p": min(1.0, p)}


def evaluate_size(n: int, k: int, runs: int) -> dict[str, Any]:
    per_alg: dict[str, list[float]] = {a: [] for a in ("nn", "nn2opt", "aco", "aco2opt", "pso")}
    aco2_vs_nn2_pct: list[float] = []   # % ACO+2opt is shorter than NN+2opt, per instance
    diffs_km: list[float] = []          # NN+2opt - ACO+2opt (>0 => ACO+2opt better)
    wins = 0

    for i in range(k):
        matrix = synthetic_matrix(n, INSTANCE_SEED_BASE + i * 1000 + n)
        nn_cost = nearest_neighbor(matrix)[1]
        nn2_cost = two_opt(matrix)[1]
        aco_mean = _stochastic_mean(lambda s: ACOOptimizer(matrix, seed=s).optimize(), matrix, runs, refine=False)
        aco2_mean = _stochastic_mean(lambda s: ACOOptimizer(matrix, seed=s).optimize(), matrix, runs, refine=True)
        pso_mean = _stochastic_mean(lambda s: PSOOptimizer(matrix, seed=s).optimize(), matrix, runs, refine=False)

        per_alg["nn"].append(nn_cost)
        per_alg["nn2opt"].append(nn2_cost)
        per_alg["aco"].append(aco_mean)
        per_alg["aco2opt"].append(aco2_mean)
        per_alg["pso"].append(pso_mean)

        diffs_km.append(nn2_cost - aco2_mean)
        if nn2_cost > 0:
            aco2_vs_nn2_pct.append((nn2_cost - aco2_mean) / nn2_cost * 100.0)
        if aco2_mean <= nn2_cost + 1e-9:
            wins += 1

    wil = wilcoxon_signed_rank(diffs_km)
    return {
        "n": n,
        "k": k,
        "agg": {a: {"mean": statistics.fmean(v), "std": statistics.pstdev(v) if len(v) > 1 else 0.0}
                for a, v in per_alg.items()},
        "aco2_vs_nn2_mean_pct": statistics.fmean(aco2_vs_nn2_pct),
        "aco2_vs_nn2_std_pct": statistics.pstdev(aco2_vs_nn2_pct) if len(aco2_vs_nn2_pct) > 1 else 0.0,
        "win_rate": wins / k,
        "wins": wins,
        "wilcoxon": wil,
    }


def format_report(rows: list[dict[str, Any]]) -> str:
    lines = ["## Multi-instance robustness (K instances/size, mean over seeds per instance)\n"]
    lines.append("| n | K | NN+2opt (μ±σ) | ACO+2opt (μ±σ) | PSO (μ±σ) | ACO+2opt scurtare medie | win-rate | Wilcoxon p |")
    lines.append("|---|---|---|---|---|---|---|---|")
    for r in rows:
        a = r["agg"]
        # positive = ACO+2opt shorter (better); negative = longer.
        lines.append(
            f"| {r['n']} | {r['k']} | "
            f"{a['nn2opt']['mean']:.2f}±{a['nn2opt']['std']:.2f} | "
            f"{a['aco2opt']['mean']:.2f}±{a['aco2opt']['std']:.2f} | "
            f"{a['pso']['mean']:.2f}±{a['pso']['std']:.2f} | "
            f"{r['aco2_vs_nn2_mean_pct']:+.2f}%±{r['aco2_vs_nn2_std_pct']:.2f} | "
            f"{r['wins']}/{r['k']} | "
            f"{r['wilcoxon']['p']:.4f} |"
        )
    lines.append("")
    for r in rows:
        w = r["wilcoxon"]
        sig = "semnificativ (p<0.05)" if w["p"] < 0.05 else "NEsemnificativ (p>=0.05)"
        lines.append(
            f"- n={r['n']}: ACO+2opt vs NN+2opt — scurtare medie {r['aco2_vs_nn2_mean_pct']:+.2f}%, "
            f"câștig {r['wins']}/{r['k']} instanțe, Wilcoxon z={w['z']:.2f}, p={w['p']:.4f} → {sig}"
        )
    return "\n".join(lines) + "\n"


def write_csv(rows: list[dict[str, Any]], path: Path) -> None:
    with path.open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["n", "k", "nn2opt_mean", "nn2opt_std", "aco2opt_mean", "aco2opt_std",
                    "aco_mean", "aco_std", "pso_mean", "pso_std",
                    "aco2_vs_nn2_mean_pct", "win_rate", "wilcoxon_z", "wilcoxon_p"])
        for r in rows:
            a = r["agg"]
            w.writerow([r["n"], r["k"],
                        f"{a['nn2opt']['mean']:.4f}", f"{a['nn2opt']['std']:.4f}",
                        f"{a['aco2opt']['mean']:.4f}", f"{a['aco2opt']['std']:.4f}",
                        f"{a['aco']['mean']:.4f}", f"{a['aco']['std']:.4f}",
                        f"{a['pso']['mean']:.4f}", f"{a['pso']['std']:.4f}",
                        f"{r['aco2_vs_nn2_mean_pct']:.4f}", f"{r['win_rate']:.4f}",
                        f"{r['wilcoxon']['z']:.4f}", f"{r['wilcoxon']['p']:.6f}"])


def main() -> None:
    parser = argparse.ArgumentParser(description="Multi-instance robustness benchmark.")
    parser.add_argument("--instances", type=int, default=K_INSTANCES)
    parser.add_argument("--runs", type=int, default=RUNS)
    parser.add_argument("--sizes", type=int, nargs="+", default=SIZES)
    parser.add_argument("--out-dir", type=Path, default=Path(__file__).resolve().parent / "results")
    args = parser.parse_args()

    args.out_dir.mkdir(parents=True, exist_ok=True)
    t0 = time.perf_counter()
    rows = [evaluate_size(n, args.instances, args.runs) for n in args.sizes]
    elapsed = time.perf_counter() - t0

    report = format_report(rows)
    print(report)
    print(f"(total {elapsed:.1f}s)")
    (args.out_dir / "robustness.md").write_text(report, encoding="utf-8")
    write_csv(rows, args.out_dir / "robustness.csv")
    print(f"Written to {args.out_dir}/ (robustness.md, robustness.csv)")


if __name__ == "__main__":
    main()
