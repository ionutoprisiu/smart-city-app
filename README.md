# Smart City App

A full-stack application that digitizes and simplifies interactions between citizens and their urban environment, straight from their mobile phone. It provides a modern solution for the most common city needs:

* **Mobility & Parking:** Quick parking payments through an integrated virtual wallet.
* **Civic Engagement (Issues):** Citizens can report local problems (potholes, broken street lights) with photo evidence, directly to city operators.
* **Smart Tourism (Visit City):** Lists city attractions and integrates a Python-based **Ant Colony Optimization (ACO)** service that suggests the optimal route to visit selected attractions, minimizing travel time.

The system brings together a **Java Spring Boot** backend, a **Python FastAPI** service for route optimization, and a cross-platform **Flutter** mobile frontend.

## Structure

```
smart-city-app/
├── backend/          # Spring Boot Backend (Port 8080)
├── frontend/         # Flutter App (iOS/Android)
└── aco-service/      # Python FastAPI ACO Service (Port 8000)
```

## Quick Start

### Backend
```bash
cd backend
./mvnw spring-boot:run
```

### ACO Service
```bash
cd aco-service
pip install -r requirements.txt
python main.py
```

### Frontend
```bash
cd frontend
flutter pub get
flutter run
```

## Configuration

### Backend
Database credentials are not committed. For local development:

1. In `backend/src/main/resources/`, copy the example file and add your credentials:
   ```bash
   cd backend/src/main/resources
   cp application-example.properties application-local.properties
   ```
2. Edit `application-local.properties` and set your PostgreSQL username and password.

Alternatively, set the `DB_USERNAME` and `DB_PASSWORD` environment variables before running the backend.

Other settings (URL, ACO service) are in `application.properties`:
```properties
spring.datasource.url=jdbc:postgresql://localhost:5432/licenta_db
aco.service.url=http://localhost:8000
```

### Frontend
When testing on a physical iOS device or a simulator that requires the local network IP, run the app with your IP address:
```bash
flutter run --dart-define=LOCAL_IP=192.168.X.X
```
*(Alternatively, temporarily change `defaultValue` in `frontend/lib/config/api_config.dart` — do **NOT** commit this change if the repository is public.)*
