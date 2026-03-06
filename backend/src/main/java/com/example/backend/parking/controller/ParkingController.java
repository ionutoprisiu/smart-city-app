package com.example.backend.parking.controller;

import com.example.backend.parking.dto.ParkingSessionResponse;
import com.example.backend.parking.dto.ParkingZoneResponse;
import com.example.backend.parking.dto.PayParkingRequest;
import com.example.backend.parking.entity.ParkingSession;
import com.example.backend.parking.entity.ParkingZone;
import com.example.backend.parking.service.ParkingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/parking")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class ParkingController {

    private final ParkingService parkingService;

    @GetMapping("/detect-zone")
    public ResponseEntity<?> detectZone(@RequestParam Double latitude, @RequestParam Double longitude) {
        ParkingZone zone = parkingService.detectParkingZone(latitude, longitude);
        return ResponseEntity.ok(Map.of("data", mapZoneToResponse(zone)));
    }

    @GetMapping("/zones")
    public ResponseEntity<?> getAllZones() {
        List<ParkingZone> zones = parkingService.getAllZones();
        return ResponseEntity.ok(Map.of("data", zones.stream().map(this::mapZoneToResponse).collect(Collectors.toList())));
    }

    @PostMapping("/pay")
    public ResponseEntity<?> payForParking(
            @RequestHeader("X-User-Id") Long userId,
            @Valid @RequestBody PayParkingRequest request) {
        ParkingSession session = parkingService.payForParking(userId, request.getZoneId(), request.getLatitude(), request.getLongitude(), request.getHours(), request.getLicensePlate());
        return ResponseEntity.ok(Map.of("data", mapSessionToResponse(session)));
    }

    @GetMapping("/active")
    public ResponseEntity<?> getActiveSession(@RequestHeader("X-User-Id") Long userId) {
        ParkingSession session = parkingService.getActiveSession(userId);
        return ResponseEntity.ok(Map.of("data", mapSessionToResponse(session)));
    }

    @GetMapping("/history")
    public ResponseEntity<?> getParkingHistory(@RequestHeader("X-User-Id") Long userId) {
        List<ParkingSession> sessions = parkingService.getUserSessions(userId);
        return ResponseEntity.ok(Map.of("data", sessions.stream().map(this::mapSessionToResponse).collect(Collectors.toList())));
    }

    private ParkingZoneResponse mapZoneToResponse(ParkingZone zone) {
        return ParkingZoneResponse.builder()
                .id(zone.getId())
                .name(zone.getName())
                .zoneNumber(zone.getZoneNumber())
                .pricePerHour(zone.getPricePerHour())
                .description(zone.getDescription())
                .build();
    }

    private ParkingSessionResponse mapSessionToResponse(ParkingSession session) {
        long remainingMinutes = session.getIsActive() && session.getEndTime().isAfter(LocalDateTime.now())
                ? Duration.between(LocalDateTime.now(), session.getEndTime()).toMinutes() : 0;
        return ParkingSessionResponse.builder()
                .id(session.getId())
                .zoneId(session.getZone().getId())
                .zoneName(session.getZone().getName())
                .zoneNumber(session.getZone().getZoneNumber())
                .licensePlate(session.getLicensePlate())
                .latitude(session.getLatitude())
                .longitude(session.getLongitude())
                .startTime(session.getStartTime())
                .endTime(session.getEndTime())
                .hoursPaid(session.getHoursPaid())
                .totalCost(session.getTotalCost())
                .isActive(session.getIsActive())
                .remainingMinutes(remainingMinutes)
                .createdAt(session.getCreatedAt())
                .build();
    }
}
