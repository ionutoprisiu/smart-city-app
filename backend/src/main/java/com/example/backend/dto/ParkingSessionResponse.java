package com.example.backend.dto;

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
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private Integer hoursPaid;
    private Double totalCost;
    private Boolean isActive;
    private Long remainingMinutes;
    private LocalDateTime createdAt;
}
