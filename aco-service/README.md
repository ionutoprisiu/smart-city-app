# ACO Service - Route Optimization

Python FastAPI microservice for optimizing tourist routes using Ant Colony Optimization (ACO).

## Quick Start

```bash
pip install -r requirements.txt
python main.py
```

Service runs on: `http://localhost:8000`

## API

### POST /optimize
Optimizes a route for a list of attractions.

**Request:**
```json
{
  "attractions": [
    {"id": 1, "latitude": 46.1914, "longitude": 24.1406, "visitTime": 30}
  ],
  "startLatitude": 46.1914,
  "startLongitude": 24.1406
}
```

**Response:**
```json
{
  "steps": [...],
  "totalDistance": 1.234,
  "totalTime": 120,
  "path": [...]
}
```

## Backend Configuration

```properties
aco.service.url=http://localhost:8000
```
