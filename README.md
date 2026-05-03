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
├── ai-service/            # FastAPI microservice for organizer–user support matching (port 8001)
├── verification-service/  # FastAPI microservice for identity verification (port 8090)
├── frontend/              # React Native (iOS) client app
├── osrm-data/             # Prepared OSRM datasets
└── docker-compose.yml     # Full local stack
```

## Architecture

### Backend (`backend`)

Modular FastAPI service with layers:

- `api/` routes + deps + HTTP errors
- `services/` business use-cases
- `integrations/` outbound clients (`aco`, `verification`, `overpass`, `ai`)
- `db/` SQLAlchemy setup + schema updates + seed
- `models/` ORM entities
- `schemas/` Pydantic DTOs
- `common/` shared exceptions

Primary responsibilities:

- auth (`/api/auth/*`)
- visit-city listing/filter/live discovery
- route optimization orchestration (`backend -> aco-service`)
- verification orchestration (`backend -> verification-service`)
- activities (events/clubs) and organizer–member chat; optional auto-reply via `backend -> ai-service` (`/api/v1/support/match`)

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

### AI Service (`ai-service`)

- exposes `POST /api/v1/support/match` only (no general “city assistant” API)
- calls **Ollama** via an OpenAI-compatible base URL (`LLM_BASE_URL`, typically `…/v1` on the host)

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
- `POST /api/activities/events/{event_id}/chat`
- `GET /api/activities/events/{event_id}/chat?userId=...`
- `POST /api/activities/clubs/{club_id}/chat`
- `GET /api/activities/clubs/{club_id}/chat?userId=...`
- `GET /health`

### AI Service (8001)

- `POST /api/v1/support/match` — semantic match for user question vs previous Q/A from the same event/club
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

Root `.env` controls PostgreSQL and OSRM dataset names.

### 2) Start full services stack

```bash
docker compose --profile with-db up -d postgres osrm-foot osrm-driving aco-service verification-service ai-service backend
```

Optional OSRM prepare profile (if datasets are not already generated):

```bash
docker compose --profile osrm-prepare up osrm-prepare-foot osrm-prepare-driving
```

### 3) Verify health

```bash
curl http://localhost:8080/health
curl http://localhost:8000/health
curl http://localhost:8001/health
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

Use your Mac LAN IP in the same Wi-Fi network as the phone.

## Quality Gates

In `frontend/`:

```bash
npm run lint
npm run typecheck
npm test -- --runInBand
```

Backend / AI (pytest inside Docker, same images as compose):

```bash
docker compose build backend ai-service
docker compose up -d backend ai-service
docker exec licenta-backend pytest tests/ -q
docker exec licenta-ai pytest tests/ -q
```

## Notes

- Project currently targets iOS for mobile client.
- Flutter frontend was removed after RN migration.
- This repository uses a single top-level README by design.

## License

Private / educational use.
