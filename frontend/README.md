# Smart City App — Frontend (Flutter)

## Quick Start

1. Start **PostgreSQL**, **aco-service** (port 8000) and **backend** (port 8080) — see root README.
2. In this folder:

```bash
flutter pub get
flutter run
```

### iPhone (same Wi-Fi as Mac)

The backend must be reachable at your Mac's IP, not `localhost`:

```bash
flutter run --dart-define=LOCAL_IP=192.168.X.X
```

### API Config

File: **`lib/config/api_config.dart`**

- **iOS:** uses `LOCAL_IP` (see above) or `defaultValue` in file.
- **Android Emulator:** `10.0.2.2:8080` (built-in).
- **macOS:** `127.0.0.1:8080`.

### If "Optimize" doesn't work

Check that **aco-service** is running on `http://localhost:8000` and that `ACO_SERVICE_URL` in `backend/.env` matches that URL.
