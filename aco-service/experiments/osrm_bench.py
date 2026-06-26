"""OSRM-based benchmark: ACO vs baselines on real street travel times.

Unlike ``benchmark.py`` (offline Haversine), this script queries the running
OSRM instances for real duration/distance matrices on the Cluj-Napoca street
network and optimizes on the duration matrix — exactly the cost the production
Visit City flow minimizes. Matrices are cached to JSON so the sensitivity study
can reuse them without re-hitting OSRM.

Usage:
    .venv/bin/python -m experiments.osrm_bench --runs 10 \
        --foot-url http://localhost:5010 --driving-url http://localhost:5011
"""
from __future__ import annotations

import argparse
import csv
import json
import statistics
import time
import urllib.request
from pathlib import Path
from typing import Any

from app.algorithms.aco import ACOOptimizer
from app.algorithms.brute_force import DEFAULT_MAX_POINTS, brute_force
from app.algorithms.nearest_neighbor import nearest_neighbor
from app.common.distance import calculate_route_cost

DATA_FILE = Path(__file__).resolve().parent.parent / "app" / "data" / "benchmark_sets.json"
RESULTS_DIR = Path(__file__).resolve().parent / "results"
MATRIX_CACHE = RESULTS_DIR / "osrm_matrices.json"

PROFILES = ("foot", "driving")


def load_dataset(path: Path = DATA_FILE) -> dict[str, Any]:
    with path.open(encoding="utf-8") as fh:
        return json.load(fh)


def build_points(dataset: dict[str, Any], attraction_ids: list[int]) -> list[dict]:
    pool = {item["id"]: item for item in dataset["pool"]}
    start = dataset["start"]
    points = [{"latitude": start["latitude"], "longitude": start["longitude"]}]
    for attraction_id in attraction_ids:
        item = pool[attraction_id]
        points.append({"latitude": item["latitude"], "longitude": item["longitude"]})
    return points


def fetch_osrm_table(points: list[dict], base_url: str, profile: str) -> dict[str, list[list[float]]]:
    coords = ";".join(f"{p['longitude']},{p['latitude']}" for p in points)
    url = f"{base_url}/table/v1/{profile}/{coords}?annotations=distance,duration"
    with urllib.request.urlopen(url, timeout=30) as response:
        data = json.loads(response.read().decode("utf-8"))
    if data.get("code") != "Ok":
        raise RuntimeError(f"OSRM table failed for {profile}: {data.get('code')}")
    durations = [[float(v) for v in row] for row in data["durations"]]
    distances = [[float(v) for v in row] for row in data["distances"]]
    return {"durations": durations, "distances": distances}


def build_matrix_cache(dataset: dict[str, Any], urls: dict[str, str]) -> dict[str, Any]:
    cache: dict[str, Any] = {"profiles": {}}
    for profile in PROFILES:
        per_set: dict[str, Any] = {}
        for set_def in dataset["sets"]:
            points = build_points(dataset, set_def["attractionIds"])
            table = fetch_osrm_table(points, urls[profile], profile)
            per_set[set_def["name"]] = {"n": len(points), **table}
            print(f"  OSRM {profile:8s} {set_def['name']:10s} n={len(points)}")
        cache["profiles"][profile] = per_set
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    MATRIX_CACHE.write_text(json.dumps(cache), encoding="utf-8")
    return cache


def _timed(func) -> tuple[Any, float]:
    start = time.perf_counter()
    result = func()
    return result, (time.perf_counter() - start) * 1000.0


def run_aco(matrix: list[list[float]], runs: int) -> dict[str, float]:
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


def evaluate_set(name: str, entry: dict[str, Any], runs: int) -> dict[str, Any]:
    # Optimize on the DURATION matrix (seconds) — the production cost metric.
    duration = entry["durations"]
    distance = entry["distances"]
    n = entry["n"]

    initial_route = list(range(n))
    initial_sec = calculate_route_cost(initial_route, duration)

    (greedy_route, greedy_sec), _ = _timed(lambda: nearest_neighbor(duration))
    aco = run_aco(duration, runs)

    # Rebuild ACO's best route once to also report its real walking/driving distance.
    best_aco = ACOOptimizer(duration, seed=0)
    best_aco_route, _ = best_aco.optimize()

    optimal_sec: float | None = None
    if n <= DEFAULT_MAX_POINTS:
        (_, optimal_sec), _ = _timed(lambda: brute_force(duration))

    def km(route: list[int]) -> float:
        return calculate_route_cost(route, distance) / 1000.0

    return {
        "name": name,
        "n": n,
        "initial_min": initial_sec / 60.0,
        "greedy_min": greedy_sec / 60.0,
        "aco_min": aco["mean"] / 60.0,
        "aco_std_min": aco["std"] / 60.0,
        "aco_best_min": aco["best"] / 60.0,
        "optimal_min": None if optimal_sec is None else optimal_sec / 60.0,
        "aco_time_ms": aco["time_ms"],
        "greedy_km": km(greedy_route),
        "aco_km": km(best_aco_route),
    }


def _improvement_pct(reference: float, value: float) -> float:
    return 0.0 if reference <= 0 else (reference - value) / reference * 100.0


def _gap_pct(optimal: float | None, value: float) -> float | None:
    if optimal is None or optimal <= 0:
        return None
    return (value - optimal) / optimal * 100.0


def format_markdown(profile: str, results: list[dict[str, Any]]) -> str:
    header = (
        f"\n### Profil {profile} — durată reală OSRM (minute)\n\n"
        "| Set | n | Inițial | NN | ACO medie±std | ACO best | Optim | ACO vs NN | ACO vs optim |\n"
        "|---|---|---|---|---|---|---|---|---|\n"
    )
    rows = []
    for r in results:
        opt = r["optimal_min"]
        opt_str = "—" if opt is None else f"{opt:.1f}"
        gap = _gap_pct(opt, r["aco_min"])
        gap_str = "—" if gap is None else f"+{gap:.1f}%"
        rows.append(
            f"| {r['name']} | {r['n']} | {r['initial_min']:.1f} | {r['greedy_min']:.1f} | "
            f"{r['aco_min']:.1f}±{r['aco_std_min']:.2f} | {r['aco_best_min']:.1f} | {opt_str} | "
            f"−{_improvement_pct(r['greedy_min'], r['aco_min']):.1f}% | {gap_str} |"
        )
    return header + "\n".join(rows) + "\n"


def write_csv(profile: str, results: list[dict[str, Any]], path: Path) -> None:
    with path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow([
            "set", "n", "initial_min", "greedy_min", "aco_mean_min", "aco_std_min",
            "aco_best_min", "optimal_min", "aco_time_ms", "greedy_km", "aco_km",
        ])
        for r in results:
            writer.writerow([
                r["name"], r["n"], f"{r['initial_min']:.4f}", f"{r['greedy_min']:.4f}",
                f"{r['aco_min']:.4f}", f"{r['aco_std_min']:.4f}", f"{r['aco_best_min']:.4f}",
                "" if r["optimal_min"] is None else f"{r['optimal_min']:.4f}",
                f"{r['aco_time_ms']:.4f}", f"{r['greedy_km']:.4f}", f"{r['aco_km']:.4f}",
            ])


def main() -> None:
    parser = argparse.ArgumentParser(description="OSRM-based ACO benchmark.")
    parser.add_argument("--runs", type=int, default=10)
    parser.add_argument("--foot-url", default="http://localhost:5010")
    parser.add_argument("--driving-url", default="http://localhost:5011")
    parser.add_argument("--use-cache", action="store_true", help="Reuse cached OSRM matrices if present.")
    args = parser.parse_args()

    dataset = load_dataset()
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    if args.use_cache and MATRIX_CACHE.exists():
        cache = json.loads(MATRIX_CACHE.read_text(encoding="utf-8"))
        print("Using cached OSRM matrices.")
    else:
        print("Fetching OSRM matrices...")
        cache = build_matrix_cache(dataset, {"foot": args.foot_url, "driving": args.driving_url})

    full_md = "# Benchmark OSRM (durate reale pe străzile din Cluj-Napoca)\n"
    for profile in PROFILES:
        per_set = cache["profiles"][profile]
        results = [evaluate_set(s["name"], per_set[s["name"]], args.runs) for s in dataset["sets"]]
        md = format_markdown(profile, results)
        print(md)
        full_md += md
        write_csv(profile, results, RESULTS_DIR / f"osrm_{profile}.csv")

    (RESULTS_DIR / "osrm_comparison.md").write_text(full_md, encoding="utf-8")
    print(f"Results written to {RESULTS_DIR}/ (osrm_comparison.md, osrm_foot.csv, osrm_driving.csv)")


if __name__ == "__main__":
    main()
