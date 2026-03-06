import logging
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional
from aco_algorithm import ACOOptimizer
from distance_calculator import calculate_distance_matrix

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

WALKING_SPEED_KMH = 4.0
MIN_ATTRACTIONS = 2
MAX_ATTRACTIONS = 50

app = FastAPI(title="ACO Route Optimization", version="1.0.0")

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
    attractions: List[AttractionRequest] = Field(..., min_length=MIN_ATTRACTIONS, max_length=MAX_ATTRACTIONS)
    startLatitude: Optional[float] = Field(default=None, ge=-90, le=90)
    startLongitude: Optional[float] = Field(default=None, ge=-180, le=180)

    @field_validator('attractions')
    @classmethod
    def validate_attractions(cls, v):
        if len(v) < MIN_ATTRACTIONS:
            raise ValueError(f"At least {MIN_ATTRACTIONS} attractions are required")
        if len(v) > MAX_ATTRACTIONS:
            raise ValueError(f"Maximum {MAX_ATTRACTIONS} attractions allowed")
        return v


class RouteStepResponse(BaseModel):
    order: int = Field(..., gt=0)
    attractionId: int = Field(..., gt=0)
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


@app.get("/")
def root():
    return {"status": "ok", "service": "ACO Route Optimization", "version": "1.0.0"}


@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "ACO Route Optimization", "version": "1.0.0"}


@app.post("/optimize", response_model=OptimizeResponse)
async def optimize_route(request: OptimizeRequest):
    try:
        logger.info(f"Optimizing route for {len(request.attractions)} attractions")
        
        attractions_data = _prepare_attractions_data(request.attractions)
        distance_matrix = calculate_distance_matrix(attractions_data)
        
        optimizer = ACOOptimizer(distance_matrix)
        best_route, best_distance = optimizer.optimize()
        
        response = _build_response(attractions_data, best_route, best_distance, distance_matrix)
        
        logger.info(f"Route optimized: {response.totalDistance:.3f} km, {response.totalTime} min")
        
        return response
        
    except ValueError as e:
        logger.warning(f"Validation error: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error optimizing route: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


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
    attractions_data: List[dict],
    best_route: List[int],
    best_distance: float,
    distance_matrix: List[List[float]]
) -> OptimizeResponse:
    steps = []
    path = []
    
    for i, route_index in enumerate(best_route):
        attraction = attractions_data[route_index]
        
        distance_to_next = None
        if i < len(best_route) - 1:
            next_index = best_route[i + 1]
            distance_to_next = round(distance_matrix[route_index][next_index], 3)
        
        step = RouteStepResponse(
            order=i + 1,
            attractionId=attraction['id'],
            attractionName=f"Attraction {attraction['id']}",
            latitude=attraction['latitude'],
            longitude=attraction['longitude'],
            distanceToNext=distance_to_next,
            estimatedVisitTime=attraction['visitTime'],
        )
        steps.append(step)
        
        path.append({
            'latitude': attraction['latitude'],
            'longitude': attraction['longitude'],
        })
    
    walking_time = int((best_distance / WALKING_SPEED_KMH) * 60)
    visit_time = sum(attr['visitTime'] for attr in attractions_data)
    total_time = walking_time + visit_time
    
    return OptimizeResponse(
        steps=steps,
        totalDistance=round(best_distance, 3),
        totalTime=total_time,
        path=path,
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )
