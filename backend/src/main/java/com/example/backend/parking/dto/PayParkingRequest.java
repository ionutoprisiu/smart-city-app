package com.example.backend.parking.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PayParkingRequest {
    // zoneId is optional — if present, use directly; otherwise auto-detect
    private Long zoneId;
    
    @NotNull(message = "Latitude is required")
    private Double latitude;
    
    @NotNull(message = "Longitude is required")
    private Double longitude;
    
    @NotNull(message = "Hours is required")
    @Min(value = 1, message = "Minimum 1 hour")
    @Max(value = 24, message = "Maximum 24 hours")
    private Integer hours;
    
    @NotBlank(message = "License plate is required")
    private String licensePlate;
}
