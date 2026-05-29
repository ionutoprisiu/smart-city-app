# OSRM Service (data + routing containers)

Prepared OpenStreetMap graphs for local routing. Runtime uses the official `osrm/osrm-backend` image via root `docker-compose.yml` (`osrm-foot`, `osrm-driving`).

## Layout

```
osrm-service/
└── data/
    ├── source/     # Geofabrik .osm.pbf (not in git)
    ├── foot/       # preprocessed foot profile (.osrm)
    └── driving/    # preprocessed car profile (.osrm)
```

`OSM_FILE` and `OSM_DATASET` in root `.env` must match the PBF basename in `data/source/`.

## Prepare graphs

From repo root:

```bash
docker compose --profile osrm-prepare up osrm-prepare-foot osrm-prepare-driving
```

## Consumers

- `aco-service` calls `http://osrm-foot:5000` and `http://osrm-driving:5001` (HTTP only; no direct access to this folder).
