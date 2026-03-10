import logging
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator, model_validator
from typing import List, Optional
from aco_algorithm import ACOOptimizer
from distance_calculator import (
    calculate_osrm_distance_matrix,
    fetch_osrm_route,
    fetch_osrm_route_segments,
    calculate_distance_matrix,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

WALKING_SPEED_KMH = 4.0
MAX_ATTRACTIONS = 50

app = FastAPI(title="ACO Route Optimization", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AttractionRequest(BaseModel):
    id: int = Field(..., gt=0)
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    visitTime: Optional[int] = Field(default=30, gt=0, le=480)

    @field_validator('visitTime')
    @classmethod
    def validate_visit_time(cls, v):
        if v is not None and (v <= 0 or v > 480):
            raise ValueError("Visit time must be between 1 and 480 minutes")
        return v or 30


class OptimizeRequest(BaseModel):
    attractions: List[AttractionRequest] = Field(..., min_length=1, max_length=MAX_ATTRACTIONS)
    startLatitude: Optional[float] = Field(default=None, ge=-90, le=90)
    startLongitude: Optional[float] = Field(default=None, ge=-180, le=180)
    useOsrm: bool = Field(default=True)

    @model_validator(mode='after')
    def validate_minimum_points(self):
        has_start = self.startLatitude is not None and self.startLongitude is not None
        if len(self.attractions) < 2 and not has_start:
            raise ValueError("Provide at least 2 attractions, or 1 attraction with a start location")
        return self


class RouteStepResponse(BaseModel):
    order: int = Field(..., gt=0)
    attractionId: int
    attractionName: str
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    distanceToNext: Optional[float] = Field(default=None, ge=0)
    estimatedVisitTime: Optional[int] = Field(default=None, gt=0)


class OptimizeResponse(BaseModel):
    steps: List[RouteStepResponse]
    totalDistance: float = Field(..., ge=0)
    totalTime: int = Field(..., ge=0)
    path: List[dict]
    routeGeometry: List[dict] = Field(default_factory=list)
    routeSegments: List[List[dict]] = Field(default_factory=list)
    usedOsrm: bool = False


@app.get("/")
def root():
    return {"status": "ok", "service": "ACO Route Optimization", "version": "2.0.0"}


@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "ACO Route Optimization", "version": "2.0.0"}


@app.post("/optimize", response_model=OptimizeResponse)
async def optimize_route(request: OptimizeRequest):
    try:
        has_start = request.startLatitude is not None and request.startLongitude is not None
        attractions_data = _prepare_attractions_data(request.attractions)
        logger.info(f"Optimizing route for {len(attractions_data)} attractions, start={has_start}, OSRM={request.useOsrm}")

        if len(attractions_data) == 1 and has_start:
            return await _single_destination_route(attractions_data[0], request)

        all_points = []
        if has_start:
            all_points.append({
                'id': 0,
                'latitude': request.startLatitude,
                'longitude': request.startLongitude,
                'visitTime': 0,
            })
        all_points.extend(attractions_data)

        used_osrm = False
        if request.useOsrm:
            distance_matrix = await calculate_osrm_distance_matrix(all_points)
            used_osrm = distance_matrix is not None
        else:
            distance_matrix = calculate_distance_matrix(all_points)

        if distance_matrix is None:
            distance_matrix = calculate_distance_matrix(all_points)
            used_osrm = False

        optimizer = ACOOptimizer(distance_matrix)
        best_route, best_distance = optimizer.optimize()

        ordered = [all_points[i] for i in best_route]
        route_geometry = []
        route_segments = []
        if used_osrm:
            route_segments = await fetch_osrm_route_segments(ordered)
            for seg in route_segments:
                route_geometry.extend(seg)

        response = _build_response(all_points, best_route, best_distance, distance_matrix, route_geometry, route_segments, used_osrm)
        logger.info(f"Route optimized: {response.totalDistance:.3f} km, {response.totalTime} min (OSRM={used_osrm})")
        return response

    except ValueError as e:
        logger.warning(f"Validation error: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error optimizing route: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


async def _single_destination_route(attraction: dict, request: OptimizeRequest) -> OptimizeResponse:
    start = {
        'id': 0,
        'latitude': request.startLatitude,
        'longitude': request.startLongitude,
        'visitTime': 0,
    }
    points = [start, attraction]

    used_osrm = False
    route_geometry = []
    if request.useOsrm:
        distance_matrix = await calculate_osrm_distance_matrix(points)
        used_osrm = distance_matrix is not None
    else:
        distance_matrix = calculate_distance_matrix(points)

    if distance_matrix is None:
        distance_matrix = calculate_distance_matrix(points)
        used_osrm = False

    distance = distance_matrix[0][1]
    route_geometry = []
    route_segments = []
    if used_osrm:
        route_segments = await fetch_osrm_route_segments(points)
        for seg in route_segments:
            route_geometry.extend(seg)

    walking_time = int((distance / WALKING_SPEED_KMH) * 60)

    steps = [
        RouteStepResponse(
            order=1, attractionId=0, attractionName="Your Location",
            latitude=start['latitude'], longitude=start['longitude'],
            distanceToNext=round(distance, 3), estimatedVisitTime=None,
        ),
        RouteStepResponse(
            order=2, attractionId=attraction['id'],
            attractionName=f"Attraction {attraction['id']}",
            latitude=attraction['latitude'], longitude=attraction['longitude'],
            distanceToNext=None, estimatedVisitTime=attraction['visitTime'],
        ),
    ]

    path = [
        {'latitude': start['latitude'], 'longitude': start['longitude']},
        {'latitude': attraction['latitude'], 'longitude': attraction['longitude']},
    ]

    return OptimizeResponse(
        steps=steps,
        totalDistance=round(distance, 3),
        totalTime=walking_time + attraction['visitTime'],
        path=path,
        routeGeometry=route_geometry if route_geometry else path,
        routeSegments=route_segments,
        usedOsrm=used_osrm,
    )


def _prepare_attractions_data(attractions: List[AttractionRequest]) -> List[dict]:
    return [
        {
            'id': attr.id,
            'latitude': attr.latitude,
            'longitude': attr.longitude,
            'visitTime': attr.visitTime or 30,
        }
        for attr in attractions
    ]


def _build_response(
    all_points: List[dict],
    best_route: List[int],
    best_distance: float,
    distance_matrix: List[List[float]],
    route_geometry: List[dict],
    route_segments: List[List[dict]],
    used_osrm: bool,
) -> OptimizeResponse:
    steps = []
    path = []

    for i, route_index in enumerate(best_route):
        point = all_points[route_index]
        is_start = point['id'] == 0

        distance_to_next = None
        if i < len(best_route) - 1:
            next_index = best_route[i + 1]
            distance_to_next = round(distance_matrix[route_index][next_index], 3)

        steps.append(RouteStepResponse(
            order=i + 1,
            attractionId=point['id'],
            attractionName="Your Location" if is_start else f"Attraction {point['id']}",
            latitude=point['latitude'],
            longitude=point['longitude'],
            distanceToNext=distance_to_next,
            estimatedVisitTime=None if is_start else point['visitTime'],
        ))

        path.append({
            'latitude': point['latitude'],
            'longitude': point['longitude'],
        })

    walking_time = int((best_distance / WALKING_SPEED_KMH) * 60)
    visit_time = sum(p['visitTime'] for p in all_points if p['id'] != 0)

    return OptimizeResponse(
        steps=steps,
        totalDistance=round(best_distance, 3),
        totalTime=walking_time + visit_time,
        path=path,
        routeGeometry=route_geometry if route_geometry else path,
        routeSegments=route_segments,
        usedOsrm=used_osrm,
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
