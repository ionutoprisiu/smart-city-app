package com.example.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RouteOptimizationResponse {

    private List<RouteStepData> steps;
    private Double totalDistance;
    private Integer totalTime;
    private List<Map<String, Double>> path;
    private List<Map<String, Double>> routeGeometry;
    private List<List<Map<String, Double>>> routeSegments;
    private Boolean usedOsrm;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class RouteStepData {
        private Integer order;
        private Long attractionId;
        private String attractionName;
        private Double latitude;
        private Double longitude;
        private Double distanceToNext;
        private Integer estimatedVisitTime;
    }
}
