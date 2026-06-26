# Smart City App

Licență — turism urban în Cluj-Napoca: atracții, traseu optim (ACO + OSRM), verificare CI/selfie, evenimente și chat cu organizatorii. Client web în React (`frontend-web`).

## Repository Layout

```
smart-city-app/
├── backend/               # FastAPI API gateway + business logic (port 8080)
├── aco-service/           # FastAPI microservice for route optimization (port 8000)
├── chat-service/          # FastAPI + Socket.IO for activity chat + LLM auto-reply (port 8002)
├── verification-service/  # FastAPI microservice for identity verification (port 8090)
├── frontend-web/          # Vite + React user app (port 8096)
├── control-web/           # Vite + React control panel (port 8095)
├── osrm-service/          # OSRM graph data + prepare (see data/)
└── docker-compose.yml     # Full local stack
```

## Architecture

### Backend (`backend`)

FastAPI, structură pe straturi (`api/`, `services/`, `integrations/`, `db/`, `models/`, `schemas/`).

Expune auth, catalog Visit City (sync Overpass la startup dacă `SYNC_ATTRACTIONS_ON_STARTUP=true`), optimizare traseu (apelează `aco-service`), verificare identitate (`verification-service`), CRUD evenimente/grupuri. Chat-ul live e în `chat-service`, nu aici.

### ACO Service (`aco-service`)

FastAPI microservice that computes optimized route order:

- builds cost matrix via OSRM `/table`
- runs Ant Colony Optimization (anchored at start point index 0)
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

### Chat Service (`chat-service`)

Support chat per eveniment/grup: istoric REST, mesaje live Socket.IO. Auto-reply opțional prin Ollama pe Mac (`LLM_MODEL=qwen2.5:7b-instruct`, `LLM_BASE_URL`); dacă modelul nu răspunde, rămân reguli lexicale și fallback din istoric Q&A.

### Frontend Web (`frontend-web`)

Vite + React + TypeScript user-facing app:

- auth flow (login/register/verification gate)
- visit-city list + filters + Leaflet map + route optimization
- **map route display**: OSRM road geometry, colored legs, parallel lane offset (see `docs/traseu-si-harta.md`)
- activities (events/clubs) with support chat toward organizers (Socket.IO)
- profile and verification screens (file upload)
- Zustand stores, shared API client, light theme for presentation

Served on port **8096** in Docker (nginx proxies `/api` → backend).

### Control Web (`control-web`)

Vite + React panel for operators and evaluation:

- login with seeded admin account (`admin@admin.com` / `ADMIN_USER_PASSWORD`)
- review `MANUAL_REVIEW` / `REJECTED` verifications; view auto-approved (`APPROVED`) cases
- **Users**: edit (name, email, role), delete, promote/demote, reset verification
- **Algorithms** — ACO/PSO benchmark lab (proxies `/research` → `aco-service`)
- served on port **8095** (nginx proxies `/api` → backend, `/research` → aco-service)

See [docs/control-panel.md](../docs/control-panel.md).

## API Overview

### Backend (8080)

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/visit-city/attractions`
- `GET /api/visit-city/attractions/live`
- `POST /api/visit-city/optimize`
- `POST /api/verification/submit`
- `GET /api/verification/status/{user_id}`
- `GET /api/admin/verifications/pending` (admin JWT)
- `POST /api/admin/verifications/{user_id}/approve` (admin JWT)
- `POST /api/admin/verifications/{user_id}/reject` (admin JWT)
- `GET /api/admin/users` (admin JWT)
- `PATCH /api/admin/users/{user_id}` (admin JWT)
- `DELETE /api/admin/users/{user_id}` (admin JWT)
- `POST /api/admin/users/{user_id}/promote-organizer` (admin JWT)
- `POST /api/admin/users/{user_id}/demote-user` (admin JWT)
- `POST /api/admin/users/{user_id}/reset-verification` (admin JWT)
- `GET /health`

### Chat Service (8002)

- `GET /api/v1/events/{eventId}/messages` — chat history (JWT)
- `GET /api/v1/clubs/{clubId}/messages` — chat history (JWT)
- Socket.IO: `chat_join`, `chat_leave`, `chat_send` → `chat:message` (JWT in connect `auth.token`)
- auto-reply: întâi caută răspunsuri manuale similare din același eveniment/grup; dacă nu găsește, extrage din descriere + anunțuri
- `GET /health`

### ACO Service (8000)

- `POST /optimize`
- `GET /research/sets` — benchmark catalog (used by control-web)
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
curl http://localhost:8002/health
curl http://localhost:8090/health
curl http://localhost:8095/
curl http://localhost:8096/
```

User app: open `http://localhost:8096`. Control panel: open `http://localhost:8095` and sign in with the seeded admin credentials from `.env` (`ADMIN_USER_EMAIL` / `ADMIN_USER_PASSWORD`).

Local dev (hot reload, proxies API to backend on 8080):

```bash
cd frontend-web && npm install && npm run dev
# or
cd control-web && npm install && npm run dev
```

## Teste

În `frontend-web/` și `control-web/`:

```bash
npm run build
npm run typecheck
```

Backend / chat (pytest inside Docker, same images as compose):

```bash
docker compose build backend chat-service
docker compose up -d backend chat-service
docker exec smart-city-backend pytest tests/ -q
docker exec smart-city-chat python -m pytest tests/ -q
```

## Documentație suplimentară

| Document | Conținut |
|----------|----------|
| [docs/traseu-si-harta.md](../docs/traseu-si-harta.md) | OSRM, geometrie traseu, vizualizare Leaflet |
| [docs/control-panel.md](../docs/control-panel.md) | Control Panel, API admin, Algorithms |
| [osrm-service/README.md](osrm-service/README.md) | Pregătire graf OSRM |

## Note

Un singur README la rădăcina `app/`. Folderul `frontend/` (React Native, legacy) nu mai face parte din fluxul principal; folosește `frontend-web`.
