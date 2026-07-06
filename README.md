# Smart City App

Licență — turism urban în Cluj-Napoca: atracții, traseu optim (ACO + OSRM), verificare CI/selfie și tururi de la ghizi rezolvate ca problemă Orienteering (selecție + ordonare sub buget de timp). Client web în React (`frontend-web`).

## Repository Layout

```
smart-city-app/
├── backend/               # FastAPI API gateway + business logic (port 8080)
├── aco-service/           # FastAPI microservice for route optimization (port 8000)
├── verification-service/  # FastAPI microservice for identity verification (port 8090)
├── frontend-web/          # Vite + React web app — user + admin panel (port 8096)
├── osrm-service/          # OSRM graph data + prepare (see data/)
└── docker-compose.yml     # Full local stack
```

## Architecture

### Backend (`backend`)

FastAPI, structură pe straturi (`api/`, `services/`, `integrations/`, `db/`, `models/`, `schemas/`).

Expune auth, catalog Visit City (sync Overpass la startup dacă `SYNC_ATTRACTIONS_ON_STARTUP=true`), optimizare traseu (apelează `aco-service`), verificare identitate (`verification-service`) și modulul **tururi** (liste candidate de la ghizi, cu durate de vizitare; la deschidere cu buget de timp → ACO-OP — CRUD local, un singur apel la `aco-service`).

### ACO Service (`aco-service`)

FastAPI microservice that computes optimized route order:

- builds cost matrix via OSRM `/table`
- runs Ant Colony Optimization (anchored at start point index 0)
- **Orienteering mode** (`timeBudgetMinutes`): maximizes collected importance score under a time budget (travel + per-attraction visit durations), reporting the skipped attractions
- fetches **one multi-waypoint** route via OSRM `/route` (`steps=true`) and splits geometry per leg
- returns `routeGeometry` (full path) and `routeSegments` (per-leg polylines)
- falls back to Haversine when OSRM is unavailable

See [docs/traseu-si-harta.md](../docs/traseu-si-harta.md) for map rendering details.

### Verification Service (`verification-service`)

FastAPI microservice for face-only identity checks:

- compares ID portrait with selfie (`insightface`)
- returns score + status: `APPROVED` / `MANUAL_REVIEW` / `REJECTED`

Layout:

- `app/models/` — result types and domain enums
- `app/vision/` — decode, preprocess, face detection and embedding extraction
- `app/services/verification_service.py` — orchestration

### Tururi (modul `tours` din `backend`) — problema Orienteering

Ghizii verificați publică tururi — liste **candidate** de atracții din catalog, cu **durata de vizitare** a fiecăreia (`POST /api/tours`, rol `GUIDE`). La deschidere, utilizatorul dă un **buget de timp** („am 2 ore"), iar `POST /api/tours/{id}/optimize` cu `timeBudgetMinutes` rulează **ACO-OP** în `aco-service`: alege subsetul de atracții care maximizează scorul de importanță colectat, cu deplasare + vizite ≤ buget, și întoarce și ce **nu** a încăput (`skippedAttractionIds`, `collectedScore`). Fără buget → comportament clasic (TSP pe toate). Vezi [docs/explicatie-detaliata-microservicii/03-tururi.md](../docs/explicatie-detaliata-microservicii/03-tururi.md).

### Frontend Web (`frontend-web`)

Vite + React + TypeScript user-facing app:

- auth flow (login/register/verification gate)
- visit-city list + filters + Leaflet map + route optimization
- **map route display**: OSRM road geometry, colored legs, parallel lane offset (see `docs/traseu-si-harta.md`)
- tururi: browse guide-published candidate tours, pick a time budget (1h/2h/…/custom) → ACO-OP builds the itinerary on the map (collected score + skipped stops shown)
- profile and verification screens (file upload)
- Zustand stores, shared API client, light theme for presentation

The **admin panel** lives inside the same app under `/admin` (feature `src/features/admin/`),
visible only to `ADMIN` accounts (styles scoped under `.admin-root`):

- **Verifications** — review `MANUAL_REVIEW` / `REJECTED`; view auto-approved (`APPROVED`) cases
- **Users** — edit (name, email, role), delete, promote/demote, reset verification
- **Algorithms** — ACO/PSO benchmark lab (proxies `/research` → `aco-service`)

Served on port **8096** in Docker (nginx proxies `/api` → backend and `/research` → aco-service).
Sign in with the seeded admin account (`ADMIN_USER_EMAIL` / `ADMIN_USER_PASSWORD`) and open the
**Admin** tab. See [docs/control-panel.md](../docs/control-panel.md).

## API Overview

### Backend (8080)

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/visit-city/attractions`
- `GET /api/visit-city/attractions/live`
- `POST /api/visit-city/optimize`
- `GET /api/tours`
- `POST /api/tours` (guide JWT)
- `POST /api/tours/{tour_id}/optimize` (optional body: `{"timeBudgetMinutes": 120}` → Orienteering)
- `POST /api/verification/submit`
- `GET /api/verification/status/{user_id}`
- `GET /api/admin/verifications/pending` (admin JWT)
- `POST /api/admin/verifications/{user_id}/approve` (admin JWT)
- `POST /api/admin/verifications/{user_id}/reject` (admin JWT)
- `GET /api/admin/users` (admin JWT)
- `PATCH /api/admin/users/{user_id}` (admin JWT)
- `DELETE /api/admin/users/{user_id}` (admin JWT)
- `POST /api/admin/users/{user_id}/promote-guide` (admin JWT)
- `POST /api/admin/users/{user_id}/demote-user` (admin JWT)
- `POST /api/admin/users/{user_id}/reset-verification` (admin JWT)
- `GET /health`

### ACO Service (8000)

- `POST /optimize` (TSP; with `timeBudgetMinutes` + per-attraction `score`/`visitDurationMinutes` → Orienteering)
- `GET /research/sets` — benchmark catalog (used by the admin Algorithms tab)
- `POST /research/compare` — offline algorithm comparison
- `GET /health`

### Verification Service (8090)

- `POST /verify` (multipart: `userId`, `idCardImage`, `selfieImage`)
- `GET /health`

## Local Run (Docker Recommended)

### Prerequisites

- Docker Desktop
- Node.js 22+ (optional, for local frontend dev)

### 1) Configure environment

```bash
cp .env.example .env
```

Copiază variabilele din `.env.example`, apoi ajustează parolele. Compose încarcă `.env` și suprascrie doar ce ține de rețeaua Docker (host `postgres`, URL-uri interne). Pentru OSRM: `OSM_FILE` / `OSM_DATASET` — vezi `osrm-service/data/source/`.

### 2) Start full services stack

```bash
docker compose up -d --build
```

Optional OSRM prepare profile (if datasets are not already generated):

```bash
docker compose --profile osrm-prepare up osrm-prepare-foot osrm-prepare-driving
```

### 3) Verify health

```bash
curl http://localhost:8080/health
curl http://localhost:8000/health
curl http://localhost:8090/health
curl http://localhost:8096/
```

Open `http://localhost:8096`. Regular users get Visit City / Tururi / Profile; signing in with the
seeded admin account (`ADMIN_USER_EMAIL` / `ADMIN_USER_PASSWORD`) also reveals the **Admin** tab
(Verifications / Users / Algorithms) at `/admin`.

Local dev (hot reload, proxies `/api` → backend on 8080 and `/research` → aco-service on 8000):

```bash
cd frontend-web && npm install && npm run dev
```

## Teste

În `frontend-web/`:

```bash
npm run build
npm run typecheck
```

Backend (pytest inside Docker, same images as compose):

```bash
docker compose build backend
docker compose up -d backend
docker exec smart-city-backend pytest tests/ -q
```

## Documentație suplimentară

| Document | Conținut |
|----------|----------|
| [docs/traseu-si-harta.md](../docs/traseu-si-harta.md) | OSRM, geometrie traseu, vizualizare Leaflet |
| [docs/control-panel.md](../docs/control-panel.md) | Zona de administrare (`/admin`), API admin, Algorithms |
| [osrm-service/README.md](osrm-service/README.md) | Pregătire graf OSRM |

## Note

Un singur README la rădăcina `app/`. Folderul `frontend/` (React Native, legacy) nu mai face parte din fluxul principal; folosește `frontend-web`.
