package com.example.backend.service;

import com.example.backend.entity.ParkingSession;
import com.example.backend.entity.ParkingZone;
import com.example.backend.entity.User;
import com.example.backend.repository.ParkingSessionRepository;
import com.example.backend.repository.ParkingZoneRepository;
import com.example.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class ParkingService {

    private final ParkingZoneRepository parkingZoneRepository;
    private final ParkingSessionRepository parkingSessionRepository;
    private final UserRepository userRepository;

    @Transactional
    public ParkingSession payForParking(Long userId, Long zoneId, Integer hours, String licensePlate) {
        if (hours == null || hours <= 0 || hours > 24) {
            throw new RuntimeException("Hours must be between 1 and 24");
        }

        if (licensePlate == null || licensePlate.trim().isEmpty()) {
            throw new RuntimeException("License plate is required");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        ParkingZone zone = parkingZoneRepository.findById(zoneId)
                .orElseThrow(() -> new RuntimeException("Parking zone not found"));

        if (!zone.getIsActive()) {
            throw new RuntimeException("Parking zone is not active");
        }

        Double totalCost = zone.getPricePerHour() * hours;

        LocalDateTime startTime = LocalDateTime.now();
        LocalDateTime endTime = startTime.plusHours(hours);

        Optional<ParkingSession> activeSession = parkingSessionRepository.findByUserAndIsActiveTrue(user);
        if (activeSession.isPresent()) {
            ParkingSession oldSession = activeSession.get();
            oldSession.setIsActive(false);
            parkingSessionRepository.save(oldSession);
        }

        ParkingSession session = ParkingSession.builder()
                .user(user)
                .zone(zone)
                .licensePlate(licensePlate.trim().toUpperCase())
                .startTime(startTime)
                .endTime(endTime)
                .hoursPaid(hours)
                .totalCost(totalCost)
                .isActive(true)
                .build();

        return parkingSessionRepository.save(session);
    }

    public ParkingSession getActiveSession(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        return parkingSessionRepository.findByUserAndIsActiveTrue(user)
                .orElseThrow(() -> new RuntimeException("No active parking session"));
    }

    public List<ParkingSession> getUserSessions(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        return parkingSessionRepository.findByUserOrderByCreatedAtDesc(user);
    }

    @Transactional
    public void deactivateExpiredSessions() {
        List<ParkingSession> expiredSessions = parkingSessionRepository.findExpiredSessions(LocalDateTime.now());

        for (ParkingSession session : expiredSessions) {
            session.setIsActive(false);
            parkingSessionRepository.save(session);
        }
    }

    public List<ParkingZone> getAllZones() {
        return parkingZoneRepository.findByIsActiveTrue();
    }
}
