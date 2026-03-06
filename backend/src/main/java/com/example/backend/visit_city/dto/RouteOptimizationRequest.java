package com.example.backend.visit_city.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Request for route optimization using ACO.
 *
 * This DTO is used to build the request to the Python ACO service.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RouteOptimizationRequest {
    
    /** List of tourist attractions to optimize. */
    private List<AttractionData> attractions;
    
    /** Starting point latitude (optional). */
    private Double startLatitude;
    
    /** Starting point longitude (optional). */
    private Double startLongitude;
    
    /** Tourist attraction data. */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class AttractionData {
        
        /** Attraction ID. */
        private Long id;
        
        /** Attraction latitude. */
        private Double latitude;
        
        /** Attraction longitude. */
        private Double longitude;
        
        /** Estimated visit time in minutes. */
        private Integer visitTime;
    }
}
