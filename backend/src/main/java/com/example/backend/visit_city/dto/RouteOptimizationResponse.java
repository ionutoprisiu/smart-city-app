package com.example.backend.visit_city.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * Response containing the optimized route from the ACO service.
 *
 * Includes route steps, total distance, estimated time and coordinates
 * for map display.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RouteOptimizationResponse {
    
    /** Optimized route steps in visiting order. */
    private List<RouteStepData> steps;
    
    /** Total route distance in kilometers. */
    private Double totalDistance;
    
    /** Total estimated time in minutes (walking + visiting). */
    private Integer totalTime;
    
    /**
     * Full route coordinates for map display.
     * Format: [{"latitude": 46.1914, "longitude": 24.1406}, ...]
     */
    private List<Map<String, Double>> path;
    
    /** A single step in the optimized route. */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class RouteStepData {
        
        /** Order in route (1, 2, 3, ...). */
        private Integer order;
        
        /** Attraction ID. */
        private Long attractionId;
        
        /** Attraction name. */
        private String attractionName;
        
        /** Attraction latitude. */
        private Double latitude;
        
        /** Attraction longitude. */
        private Double longitude;
        
        /** Distance to the next attraction in kilometers (null for the last one). */
        private Double distanceToNext;
        
        /** Estimated visit time in minutes. */
        private Integer estimatedVisitTime;
    }
}
