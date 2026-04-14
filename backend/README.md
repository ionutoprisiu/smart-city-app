# Backend (FastAPI)

## Layout

```
app/
├── main.py              # App factory, CORS, router mounting, /health
├── core/                # Settings & shared dependencies
│   ├── config.py        # Pydantic Settings (env)
│   └── deps.py          # get_db(), etc.
├── db/                  # SQLAlchemy
│   ├── base.py          # DeclarativeBase
│   └── session.py       # engine + SessionLocal
├── api/
│   └── routes/          # HTTP endpoints (thin — delegate to services)
│       ├── auth.py
│       └── visit_city.py
├── models/              # ORM models
├── schemas/             # Pydantic request/response DTOs
└── services/            # Business logic & external calls (ACO, Overpass)
```

Run locally: `uvicorn app.main:app --host 0.0.0.0 --port 8080` (from `backend/` with venv and `.env`).
