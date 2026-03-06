package com.example.backend.parking.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ParkingSessionResponse {
    private Long id;
    private Long zoneId;
    private String zoneName;
    private Integer zoneNumber;
    private String licensePlate;
    private Double latitude;
    private Double longitude;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private Integer hoursPaid;
    private Double totalCost;
    private Boolean isActive;
    private Long remainingMinutes; // Minutes remaining until expiration
    private LocalDateTime createdAt;
}
