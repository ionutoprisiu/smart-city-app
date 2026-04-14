# Smart City App

Full-stack application focused on **Visit City (smart tourism)**: attractions from the database (plus optional OSM live refresh), selection on the map, and **optimal walking/driving route** via **ACO** + **OSRM**.

**Stack:** FastAPI (API + DB), FastAPI (ACO + OSRM), FastAPI (verification), Flutter (iOS/Android), PostgreSQL.

---

## Project Structure

```
licenta-app/
├── backend/          # FastAPI (port 8080) — auth + Visit City
├── frontend/         # Flutter — Visit City + map + auth
├── aco-service/      # ACO + OSRM (port 8000)
├── verification-service/ # ID card + selfie verification (port 8090)
└── docker-compose.yml
```

---

## Visit City — How It Works

1. **Attractions** — From the DB; optional live merge from **Overpass** (Cluj-Napoca area).
2. **Map** — Clustering, custom pins, add/remove attractions to the route.
3. **Optimize** — Sends selection to `backend` → **ACO service** (OSRM Table + Route, or Haversine fallback).
4. **Start / Modify** — After optimization, the user can start the route or change selection.

---

## Quick Start

### Prerequisites

- Python 3.11+
- PostgreSQL (`licenta_db`)
- Flutter SDK

### Order (local)

1. PostgreSQL
2. **ACO** (port 8000)
3. **Verification Service** (port 8090)
4. **Backend** (port 8080)
5. **Flutter**

### 1. Database

```bash
createdb licenta_db
```

Tables are created at backend startup (`create_all`).

### 2. ACO Service

```bash
cd aco-service
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Runs on **http://localhost:8000**. Health: `GET /health`. Route: `POST /optimize`.

### 3. Backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8080
```

Runs on **http://localhost:8080**. Docs: `http://localhost:8080/docs`.

`backend/.env`:

```env
DATABASE_URL=postgresql+psycopg2://postgres:postgres@localhost:5432/licenta_db
ACO_SERVICE_URL=http://localhost:8000
VERIFICATION_SERVICE_URL=http://localhost:8090
CORS_ORIGINS_RAW=*
```

Local admin seed (optional, enabled by default in current backend config):

```env
SEED_ADMIN_USER=true
ADMIN_USER_EMAIL=admin@admin.com
ADMIN_USER_PASSWORD=admin
```

### 4. Verification Service

```bash
cd verification-service
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8090
```

Runs on **http://localhost:8090**. Health: `GET /health`. Verify: `POST /verify`.

### 5. Frontend

```bash
cd frontend
flutter pub get
flutter run
```

| Platform | Backend URL |
|----------|-------------|
| iOS Simulator (physical) | `http://<LOCAL_IP>:8080/api` |
| Android Emulator | `10.0.2.2:8080` |
| macOS | `127.0.0.1:8080` |

### Docker (full stack)

1. Copy `.env.example` to `.env` at repo root.
2. Optional OSRM prep: `docker compose --profile osrm-prepare up osrm-prepare-foot osrm-prepare-driving`
3. `docker compose up --build`

Dacă în Docker Desktop apar containere oprite (resturi vechi): `docker container prune -f`.

---

## API (what the app uses)

| Area | Backend (8080) | ACO (8000) | Verification (8090) |
|------|----------------|------------|---------------------|
| Auth | `POST /api/auth/register`, `POST /api/auth/login` | — | — |
| Visit City | `GET /api/visit-city/attractions`, `.../live`, `POST .../optimize` | `POST /optimize` | — |
| Verification | `POST /api/verification/submit`, `GET /api/verification/status/{user_id}` | — | `POST /verify` |

---

## License

Private / educational use (thesis project).
