package com.example.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RouteOptimizationRequest {

    private List<AttractionData> attractions;
    private Double startLatitude;
    private Double startLongitude;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class AttractionData {
        private Long id;
        private Double latitude;
        private Double longitude;
        private Integer visitTime;
    }
}
