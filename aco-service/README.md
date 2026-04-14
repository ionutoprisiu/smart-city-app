# ACO route service (OSRM)

## Essence (technical)

The app sends points to this service. **ACO** optimizes **visit order** using a **cost matrix** from OSRM **`/table`** (or, on failure, **Haversine** straight-line distances). After the order is fixed, the service requests OSRM **`/route`** per consecutive leg for **map geometry** and travel-time estimation.

Credible **pedestrian** results require an OSRM deployment whose data was **preprocessed with `foot.lua`**, not merely sending `foot` in the URL against a **car**-built graph.

---

## `routingProfile` vs the real OSRM backend

**This service** only accepts two values: `driving` and `foot`. They are the **modes exposed by this app’s API**, not an exhaustive list of every profile OSRM can build (upstream docs often discuss e.g. car, bicycle, foot; v5 HTTP profile names depend on how you name and expose the service).

Those values select the **path segment** in calls to this deployment’s OSRM: `/table/v1/{profile}/...` and `/route/v1/{profile}/...`.

That segment is **not** sufficient by itself: OSRM’s **mode of transport** is determined by the **Lua profile used at `osrm-extract`**, not only by the URL. If a single `OSRM_BASE_URL` points at an instance built for **cars**, sending `foot` in the request does **not** turn it into an authentic pedestrian backend.

**Practical design:** OSRM’s model matches **one preprocessed graph per mode** — so you typically have **one OSRM build / one `osrm-routed` instance per transport mode** (e.g. a car build and a foot build from the same OSM extract). This service supports **separate base URLs per mode**:

| Env var | Used when | Fallback |
|--------|-----------|----------|
| `OSRM_FOOT_BASE_URL` | `routingProfile` is `foot` | `OSRM_BASE_URL` |
| `OSRM_DRIVING_BASE_URL` | `routingProfile` is `driving` | `OSRM_BASE_URL` |
| `OSRM_BASE_URL` | If the mode-specific URL is unset | — |

Set **`OSRM_FOOT_BASE_URL`** to an instance built with **`foot.lua`** and **`OSRM_DRIVING_BASE_URL`** (or only `OSRM_BASE_URL`) to a car build — otherwise walking requests may still hit a car graph and look like driving routes.

Otherwise `routingProfile` is **intent in the application**, not a **guarantee** about the graph. OSRM recommends **separate extracts** per profile from the same OSM file.

---

## ACO: fixed start at node `0`

The optimizer **always** starts the tour at **index `0`**:

- **With** `startLatitude` / `startLongitude`: node `0` is the user’s location → open tour from a fixed real start.  
- **Without** start: node `0` is the **first attraction in the request payload order** (as assembled by the backend). The problem is then **best order among the rest, starting from that anchor** — not a fully symmetric TSP where any node could be the optimal start.

To change that behaviour you would need different product rules (e.g. try several candidate starts, or cyclic tour then drop the worst edge).

---

## `visitTime` vs what ACO optimizes

`visitTime` per attraction is **metadata**: it feeds **total time** (travel + visits) in the response. It does **not** enter the **cost matrix** unless you extend the model. The optimizer minimizes **movement cost** (duration or Haversine distance), not a combined “quality of the whole day” objective. If that is intentional, no change is required; if you wanted “best visiting experience” in a broader sense, that would be a different optimization problem.

---

## OSRM `table` vs `route` and `_travel_time_minutes`

- **`/table`**: shortest-path **durations/distances between pairs** of snapped points.  
- **`/route`**: path along the **ordered** legs after optimization.

They should be **close**; small differences can come from snapping, parameters, or geometry. The service **reconciles** leg durations from `route` with table aggregates when they disagree badly — a **robustness** measure, not a formal guarantee that both models are identical.

---

## Haversine fallback

If OSRM is unavailable, costs fall back to **great-circle distances**. That is **not** equivalent to routing on the road/path network: the optimizer then minimizes **air distance**, not network travel. Results are **best-effort** and not comparable in realism to OSRM-backed runs. Document this when presenting outputs to users.

---

## Why pedestrian routes can look wrong (incl. public demo)

Per **OSRM**’s model, the transport profile is tied to data **preprocessed** with `osrm-extract` and the chosen **Lua profile** — it is **not** something you fix **merely by changing the profile in the URL** (whether it appears as `foot`, `walking`, `cycling`, `driving`, etc.). What actually matters is **which profile was used when the `.osrm` dataset was built**, not the string in the request path.

So: **routes do not automatically become credible pedestrian routes if the dataset was built for the car profile** (or another mode). The API profile name must match a server that was actually built with the matching Lua profile (e.g. `profiles/foot.lua` for walking).

The public server **`router.project-osrm.org`** is **not** a reliable basis for validating pedestrian routing; project discussions have long noted that the demo has often behaved like a **car-centric** setup or inconsistently for bike/walk compared to a self-hosted build.

---

## What to do for real walking (footways, paths, etc.)

1. Extract the map with the **foot** profile into a **separate** output from car/bicycle (OSM recommends separate builds per mode).
2. Run a dedicated **`osrm-routed`** instance on that foot dataset.
3. Point this service at it: **`OSRM_FOOT_BASE_URL`** (preferred) or **`OSRM_BASE_URL`** if you use a single foot-only server (no trailing slash), e.g. `http://localhost:5000`. For **mixed** car + walk in the same app, run two `osrm-routed` processes (foot + car) and set e.g. `OSRM_FOOT_BASE_URL=http://127.0.0.1:5000` and `OSRM_DRIVING_BASE_URL=http://127.0.0.1:5001`.

Example (adjust paths to your layout):

```bash
osrm-extract -p profiles/foot.lua cluj.osm.pbf -d /data/foot/cluj
osrm-partition /data/foot/cluj.osrm
osrm-customize /data/foot/cluj.osrm
osrm-routed --algorithm mld /data/foot/cluj.osrm
```

Then (foot-only deployment):

```bash
export OSRM_FOOT_BASE_URL=http://127.0.0.1:5000
# or: export OSRM_BASE_URL=http://127.0.0.1:5000
python main.py
```

This app calls `/table/v1/foot/...` and `/route/v1/foot/...` against the **foot** base URL; you get meaningful pedestrian geometry only when that server’s data was produced with **`foot.lua`** (or equivalent foot preprocessing).

---

## Project structure

```
aco-service/
├── app/
│   ├── __init__.py
│   ├── main.py          # FastAPI app, CORS, router
│   ├── schemas.py        # Pydantic request/response models
│   ├── routes.py         # Endpoint handlers + helpers
│   ├── optimizer.py      # ACO algorithm (colony optimiser)
│   └── distance.py       # OSRM + Haversine distance/matrix helpers
├── Dockerfile
├── requirements.txt
└── README.md
```

---

## Run locally (default: public OSRM)

```bash
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

`GET /health` — `POST /optimize`

---

## Testing checklist (README vs real behaviour)

Use this to confirm the docs match what you run:

1. **`GET /health`** returns 200 when the Python service is up.
2. **Against your own OSRM (foot build):** set `OSRM_FOOT_BASE_URL` (or `OSRM_BASE_URL` if foot-only), call `POST /optimize` with `routingProfile: "foot"` and a few points in that extract’s area — response should have `usedOsrm: true`, non-empty `routeSegments`, plausible `totalDistance` / `travelTimeMinutes`.
3. **Profile mismatch sanity check:** if `OSRM_FOOT_BASE_URL` falls back to a **car-only** `OSRM_BASE_URL`, walking may still follow car geometry — set an explicit foot server URL; OSRM may also error or return incoherent results when profile and dataset disagree.
4. **Fallback:** stop OSRM or use a bad URL — service should still respond with Haversine-based order (`usedOsrm: false`); distances/times are **not** network-realistic.
5. **No GPS:** same attractions order in the request should anchor node `0`; changing backend ordering should change which attraction behaves as start when no `startLatitude`/`startLongitude`.
6. **`visitTime`:** verify `totalTime` ≈ `travelTimeMinutes` + `visitTimeMinutes` for your test payload.
