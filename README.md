# Smart City App

A full-stack application that digitizes and simplifies interactions between citizens and their urban environment. It provides:

* **Mobility & Parking** — Parking payments via an integrated virtual wallet.
* **Civic Engagement (Issues)** — Report local problems (potholes, broken street lights) with photo evidence to city operators.
* **Smart Tourism (Visit City)** — Explore city attractions, select multiple points on a map, and get an **optimal walking/driving route** computed by an **Ant Colony Optimization (ACO)** service, with **OSRM** for real-road distances and route geometry.

The stack: **Java Spring Boot** backend, **Python FastAPI** ACO service (with OSRM), **Flutter** mobile frontend, **PostgreSQL** database.

---

## Structure

```
licenta-app/
├── backend/          # Spring Boot (port 8080) — API, auth, DB, Visit City orchestration
├── frontend/         # Flutter app (iOS / Android) — Visit City list + map, auth, home
└── aco-service/      # Python FastAPI (port 8000) — ACO route optimization + OSRM
```

---

## Visit City — How It Works

1. **Attractions** — Loaded from the database; optionally refreshed in the background from **Overpass (OpenStreetMap)** for the city area (e.g. Cluj-Napoca). Search and category filters apply to the list.
2. **Map** — User sees attractions (with clustering when no route is selected), can add **custom pins** (long-press), and **add/remove attractions to the route** via the bottom sheet (“Add to route” / “Remove from route”).
3. **Optimize** — When at least 2 attractions (or 1 + user location) are selected, **Optimize** sends the selection to the backend. The backend calls the **ACO service**, which:
   - Builds a **distance matrix** via **OSRM Table API** (real-road distances; fallback: Haversine).
   - Runs **ACO** to find the **order of visits** that minimizes total distance.
   - Fetches **route geometry** per leg via **OSRM Route API** (polylines on the road).
4. **Start / Modify** — After optimization, the user can **Start** the route (map shows only route markers and polyline) or **Modify** to change selection and re-optimize. **Clear** removes the route and selection.

**Tech:** ACO in `aco-service/aco_algorithm.py`; OSRM in `aco-service/distance_calculator.py` (Table + Route APIs). Backend: `VisitCityController`, `VisitCityService`, `RouteOptimizationService`; frontend: `VisitCityProvider`, `VisitCityRepository`, `MapScreen`, `VisitCityScreen`.

---

## Quick Start

### 1. Database (PostgreSQL)

Create a database (e.g. `licenta_db`). Credentials via environment or local config (see [Configuration](#configuration)).

### 2. Backend

```bash
cd backend
./mvnw spring-boot:run
```

Runs on **http://localhost:8080**. API base path: `/api`.

### 3. ACO Service

```bash
cd aco-service
pip install -r requirements.txt
python main.py
```

Runs on **http://localhost:8000**. Endpoint: `POST /optimize`.

### 4. Frontend

```bash
cd frontend
flutter pub get
flutter run
```

For a **physical iOS device** (same Wi‑Fi as your machine), pass your machine’s IP:

```bash
flutter run --dart-define=LOCAL_IP=192.168.X.X
```

Alternatively, set the IP in `frontend/lib/config/api_config.dart` (do **not** commit it if the repo is public).

---

## Configuration

### Backend

- **Database:** Copy `backend/src/main/resources/application-example.properties` to `application-local.properties` (gitignored) and set `DB_USERNAME` and `DB_PASSWORD`, or set the `DB_USERNAME` and `DB_PASSWORD` environment variables.
- **ACO service URL** in `application.properties`:
  ```properties
  aco.service.url=http://localhost:8000
  ```

### Frontend

- **API base URL:** `frontend/lib/config/api_config.dart` — uses `LOCAL_IP` for iOS, `10.0.2.2` for Android emulator, `127.0.0.1` for macOS.

### ACO Service

- **OSRM:** Uses public `https://router.project-osrm.org` (Table + Route). No API key required. For production you may run your own OSRM instance and change `OSRM_BASE_URL` in `aco-service/distance_calculator.py`.

---

## API Overview

| Area        | Backend (port 8080)     | ACO (port 8000)   |
|------------|--------------------------|-------------------|
| Auth       | `POST /api/auth/login`, `.../register` | —                 |
| Visit City | `GET /api/visit-city/attractions`, `.../attractions/live`, `POST .../optimize` | `POST /optimize`  |
| Parking    | `/api/parking/...`       | —                 |
| Issues     | `/api/issues/...`        | —                 |

The backend forwards optimization requests to the ACO service and enriches the response (e.g. attraction names from the DB).

---

## License

Private / educational use as appropriate for your thesis (licență).
