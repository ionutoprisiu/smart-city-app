# Smart City App

Full-stack thesis project for smart tourism in Cluj-Napoca:

- user auth + profile
- attraction discovery and map exploration
- route optimization (ACO + OSRM)
- ID verification (ID card + selfie)
- iOS mobile app in React Native

## Repository Layout

```
licenta-app/
├── backend/               # FastAPI API gateway + business logic (port 8080)
├── aco-service/           # FastAPI microservice for route optimization (port 8000)
├── chat-service/          # FastAPI + Socket.IO for activity chat + LLM auto-reply (port 8002)
├── verification-service/  # FastAPI microservice for identity verification (port 8090)
├── frontend/              # React Native (iOS) client app
├── osrm-service/          # OSRM graph data + prepare (see data/)
└── docker-compose.yml     # Full local stack
```

## Architecture

### Backend (`backend`)

Modular FastAPI service with layers:

- `api/` routes + deps + HTTP errors
- `services/` business use-cases
- `integrations/` outbound clients (`aco`, `verification`, `overpass`)
- `db/` SQLAlchemy setup + schema updates + seed
- `models/` ORM entities
- `schemas/` Pydantic DTOs
- `common/` shared exceptions

Primary responsibilities:

- auth (`/api/auth/*`)
- visit-city listing/filter/live discovery
- route optimization orchestration (`backend -> aco-service`)
- verification orchestration (`backend -> verification-service`)
- activities (events/clubs); support chat via `chat-service` (REST history + Socket.IO + in-process LLM auto-reply)

### ACO Service (`aco-service`)

FastAPI microservice that computes optimized route order:

- builds cost matrix via OSRM `/table`
- runs Ant Colony Optimization (anchored at start point index 0)
- fetches per-leg geometry via OSRM `/route`
- falls back to Haversine when OSRM is unavailable

### Verification Service (`verification-service`)

FastAPI microservice for identity checks:

- face comparison between ID portrait and selfie (`insightface`)
- OCR text extraction preview (`pytesseract`)
- decision thresholds: approved / manualReview / rejected

### Chat Service (`chat-service`)

- activity support chat (REST + Socket.IO)
- semantic auto-reply via **Ollama** (`LLM_BASE_URL`, typically `http://host.docker.internal:11434/v1` on the host)
- lexical fallback when the LLM is unavailable

### Frontend (`frontend`)

React Native + TypeScript app (iOS-first):

- auth flow (login/register/verification gate)
- visit-city list + filters + map + route steps
- activities (events/clubs) with support chat toward organizers
- profile and verification screens
- shared API client, storage, theming, validators

## API Overview

### Backend (8080)

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/visit-city/attractions`
- `GET /api/visit-city/attractions/live`
- `POST /api/visit-city/optimize`
- `POST /api/verification/submit`
- `GET /api/verification/status/{user_id}`
- `GET /health`

### Chat Service (8002)

- `GET /api/v1/events/{eventId}/messages` — chat history (JWT)
- `GET /api/v1/clubs/{clubId}/messages` — chat history (JWT)
- Socket.IO: `chat_join`, `chat_leave`, `chat_send` → `chat:message` (JWT in connect `auth.token`)
- in-process LLM match for organizer auto-reply (Ollama + lexical fallback)
- `GET /health`

### ACO Service (8000)

- `POST /optimize`
- `GET /health`

### Verification Service (8090)

- `POST /verify` (multipart: `userId`, `idCardImage`, `selfieImage`)
- `GET /health`

## Local Run (Docker Recommended)

### Prerequisites

- Docker Desktop
- Xcode (for iOS run)
- Node.js 22+ (for frontend)

### 1) Configure environment

```bash
cp .env.example .env
```

Root `.env` controls PostgreSQL and OSRM dataset names (`OSM_FILE` / `OSM_DATASET`; default Romania extract in `osrm-service/data/source/`).

### 2) Start full services stack

```bash
docker compose --profile with-db up -d postgres osrm-foot osrm-driving aco-service verification-service chat-service backend
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
```

## Run Frontend (iOS)

```bash
cd frontend
npm install
cd ios && pod install && cd ..
npm start
npx react-native run-ios --device "Ionut’s iPhone" --no-packager
```

For physical iPhone, backend base URL is set in:

- `frontend/src/shared/api/config.ts`

Use your Mac LAN IP in the same Wi-Fi network as the phone. Chat uses port **8002** (`frontend/src/shared/api/chatConfig.ts`, same `LOCAL_IP` as the API).

## Quality Gates

In `frontend/`:

```bash
npm run lint
npm run typecheck
npm test -- --runInBand
```

Backend / chat (pytest inside Docker, same images as compose):

```bash
docker compose build backend chat-service
docker compose up -d backend chat-service
docker exec licenta-backend pytest tests/ -q
docker exec licenta-chat python -m pytest tests/ -q
```

## Notes

- Project currently targets iOS for mobile client.
- This repository uses a single top-level README by design.

## License

Private / educational use.
