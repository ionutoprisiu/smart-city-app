package com.example.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ParkingZoneResponse {
    private Long id;
    private String name;
    private Integer zoneNumber;
    private Double pricePerHour;
    private String description;
}
