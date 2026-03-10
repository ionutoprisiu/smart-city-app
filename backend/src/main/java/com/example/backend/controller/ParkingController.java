package com.example.backend.controller;

import com.example.backend.dto.ParkingSessionResponse;
import com.example.backend.dto.ParkingZoneResponse;
import com.example.backend.dto.PayParkingRequest;
import com.example.backend.entity.ParkingSession;
import com.example.backend.entity.ParkingZone;
import com.example.backend.service.ParkingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Map;

@RestController
@RequestMapping("/api/parking")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class ParkingController {

    private final ParkingService parkingService;

    @GetMapping("/zones")
    public ResponseEntity<?> getAllZones() {
        return ResponseEntity.ok(Map.of("data",
                parkingService.getAllZones().stream().map(this::mapZone).toList()));
    }

    @PostMapping("/pay")
    public ResponseEntity<?> payForParking(
            @RequestHeader("X-User-Id") Long userId,
            @Valid @RequestBody PayParkingRequest request) {
        ParkingSession session = parkingService.payForParking(
                userId, request.getZoneId(), request.getHours(), request.getLicensePlate());
        return ResponseEntity.ok(Map.of("data", mapSession(session)));
    }

    @GetMapping("/active")
    public ResponseEntity<?> getActiveSession(@RequestHeader("X-User-Id") Long userId) {
        return ResponseEntity.ok(Map.of("data", mapSession(parkingService.getActiveSession(userId))));
    }

    @GetMapping("/history")
    public ResponseEntity<?> getParkingHistory(@RequestHeader("X-User-Id") Long userId) {
        return ResponseEntity.ok(Map.of("data",
                parkingService.getUserSessions(userId).stream().map(this::mapSession).toList()));
    }

    private ParkingZoneResponse mapZone(ParkingZone zone) {
        return ParkingZoneResponse.builder()
                .id(zone.getId())
                .name(zone.getName())
                .zoneNumber(zone.getZoneNumber())
                .pricePerHour(zone.getPricePerHour())
                .description(zone.getDescription())
                .build();
    }

    private ParkingSessionResponse mapSession(ParkingSession session) {
        long remaining = session.getIsActive() && session.getEndTime().isAfter(LocalDateTime.now())
                ? Duration.between(LocalDateTime.now(), session.getEndTime()).toMinutes() : 0;
        return ParkingSessionResponse.builder()
                .id(session.getId())
                .zoneId(session.getZone().getId())
                .zoneName(session.getZone().getName())
                .zoneNumber(session.getZone().getZoneNumber())
                .licensePlate(session.getLicensePlate())
                .startTime(session.getStartTime())
                .endTime(session.getEndTime())
                .hoursPaid(session.getHoursPaid())
                .totalCost(session.getTotalCost())
                .isActive(session.getIsActive())
                .remainingMinutes(remaining)
                .createdAt(session.getCreatedAt())
                .build();
    }
}
