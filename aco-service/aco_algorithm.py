import logging
from typing import List, Tuple
from distance_calculator import calculate_route_distance

logger = logging.getLogger(__name__)

NUM_ANTS = 30
MAX_ITERATIONS = 200
ALPHA = 1.0
BETA = 2.0
RHO = 0.5
Q = 100.0
INITIAL_PHEROMONE = 1.0
EARLY_STOPPING_THRESHOLD = 50


class ACOOptimizer:
    def __init__(self, distance_matrix: List[List[float]]):
        if not distance_matrix:
            raise ValueError("Distance matrix cannot be empty")
        
        self.distance_matrix = distance_matrix
        self.num_attractions = len(distance_matrix)
        
        if self.num_attractions < 2:
            raise ValueError("At least 2 attractions are required")
        
        self.pheromones = [
            [INITIAL_PHEROMONE for _ in range(self.num_attractions)]
            for _ in range(self.num_attractions)
        ]
        
        self.best_route: List[int] = []
        self.best_distance = float('inf')
        
        logger.info(f"ACO initialized: {self.num_attractions} attractions")
    
    def _calculate_visibility(self, i: int, j: int) -> float:
        distance = self.distance_matrix[i][j]
        if distance == 0:
            return 0.0
        return 1.0 / distance
    
    def _calculate_probability(self, current: int, unvisited: List[int]) -> List[float]:
        if not unvisited:
            return []
        
        numerators = []
        total = 0.0
        
        for next_attraction in unvisited:
            pheromone = self.pheromones[current][next_attraction]
            visibility = self._calculate_visibility(current, next_attraction)
            numerator = (pheromone ** ALPHA) * (visibility ** BETA)
            numerators.append(numerator)
            total += numerator
        
        if total > 0:
            probabilities = [num / total for num in numerators]
        else:
            probabilities = [1.0 / len(unvisited)] * len(unvisited)
        
        return probabilities
    
    def _construct_route(self) -> List[int]:
        import random
        
        route = [0]
        unvisited = list(range(1, self.num_attractions))
        
        while unvisited:
            current = route[-1]
            probabilities = self._calculate_probability(current, unvisited)
            next_attraction = random.choices(unvisited, weights=probabilities)[0]
            route.append(next_attraction)
            unvisited.remove(next_attraction)
        
        return route
    
    def _update_pheromones(self, routes: List[List[int]], distances: List[float]):
        for i in range(self.num_attractions):
            for j in range(self.num_attractions):
                self.pheromones[i][j] *= (1 - RHO)
        
        for route, distance in zip(routes, distances):
            if distance > 0:
                pheromone_deposit = Q / distance
                for i in range(len(route) - 1):
                    from_idx = route[i]
                    to_idx = route[i + 1]
                    self.pheromones[from_idx][to_idx] += pheromone_deposit
    
    def optimize(self) -> Tuple[List[int], float]:
        no_improvement_count = 0
        
        for iteration in range(MAX_ITERATIONS):
            routes = []
            distances = []
            
            for _ in range(NUM_ANTS):
                route = self._construct_route()
                distance = calculate_route_distance(route, self.distance_matrix)
                
                routes.append(route)
                distances.append(distance)
                
                if distance < self.best_distance:
                    self.best_distance = distance
                    self.best_route = route.copy()
                    no_improvement_count = 0
                else:
                    no_improvement_count += 1
            
            self._update_pheromones(routes, distances)
            
            if no_improvement_count > EARLY_STOPPING_THRESHOLD:
                logger.info(f"Early stopping at iteration {iteration + 1}")
                break
        
        return self.best_route, self.best_distance
