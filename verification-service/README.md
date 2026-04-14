# Verification Service

Local, free FastAPI microservice for ID card + selfie verification.

## Features

- Face comparison (ID card portrait vs selfie) using local AI `insightface`
- OCR text extraction preview using `pytesseract`
- Configurable decision thresholds: `APPROVED`, `MANUAL_REVIEW`, `REJECTED`

## Run locally

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
uvicorn app.main:app --reload --port 8090
```

## API

- `GET /health`
- `POST /verify` multipart form:
  - `userId` (int)
  - `idCardImage` (file)
  - `selfieImage` (file)
