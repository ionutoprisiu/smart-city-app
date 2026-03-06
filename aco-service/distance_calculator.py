import math


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    
    lat1_rad = math.radians(lat1)
    lon1_rad = math.radians(lon1)
    lat2_rad = math.radians(lat2)
    lon2_rad = math.radians(lon2)
    
    dlat = lat2_rad - lat1_rad
    dlon = lon2_rad - lon1_rad
    
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c


def calculate_distance_matrix(attractions: list[dict]) -> list[list[float]]:
    n = len(attractions)
    distance_matrix = [[0.0 for _ in range(n)] for _ in range(n)]
    
    for i in range(n):
        for j in range(n):
            if i == j:
                distance_matrix[i][j] = 0.0
            else:
                lat1 = attractions[i]['latitude']
                lon1 = attractions[i]['longitude']
                lat2 = attractions[j]['latitude']
                lon2 = attractions[j]['longitude']
                distance_matrix[i][j] = haversine_distance(lat1, lon1, lat2, lon2)
    
    return distance_matrix


def calculate_route_distance(route: list[int], distance_matrix: list[list[float]]) -> float:
    if len(route) < 2:
        return 0.0
    
    total_distance = 0.0
    for i in range(len(route) - 1):
        total_distance += distance_matrix[route[i]][route[i + 1]]
    
    return total_distance
