package com.example.backend.parking.service;

import com.example.backend.parking.entity.ParkingSession;
import com.example.backend.parking.entity.ParkingZone;
import com.example.backend.parking.repository.ParkingSessionRepository;
import com.example.backend.parking.repository.ParkingZoneRepository;
import com.example.backend.user.entity.User;
import com.example.backend.user.repository.UserRepository;
import com.example.backend.wallet.entity.Wallet;
import com.example.backend.wallet.entity.Transaction;
import com.example.backend.wallet.entity.TransactionCategory;
import com.example.backend.wallet.service.WalletService;
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
    private final WalletService walletService;

    public ParkingZone detectParkingZone(Double latitude, Double longitude) {
        List<ParkingZone> zones = parkingZoneRepository.findByIsActiveTrue();

        for (ParkingZone zone : zones) {
            if (latitude >= zone.getMinLatitude() &&
                    latitude <= zone.getMaxLatitude() &&
                    longitude >= zone.getMinLongitude() &&
                    longitude <= zone.getMaxLongitude()) {
                return zone;
            }
        }

        return parkingZoneRepository.findByZoneNumberAndIsActiveTrue(2)
                .orElseThrow(() -> new RuntimeException("No parking zone found for location"));
    }

    @Transactional
    public ParkingSession payForParking(Long userId, Long zoneId, Double latitude, Double longitude, Integer hours,
            String licensePlate) {
        if (hours == null || hours <= 0 || hours > 24) {
            throw new RuntimeException("Hours must be between 1 and 24");
        }

        if (licensePlate == null || licensePlate.trim().isEmpty()) {
            throw new RuntimeException("License plate is required");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (user.getLicensePlate() == null || !user.getLicensePlate().equals(licensePlate.trim().toUpperCase())) {
            user.setLicensePlate(licensePlate.trim().toUpperCase());
            userRepository.save(user);
        }

        ParkingZone zone;
        if (zoneId != null) {
            zone = parkingZoneRepository.findById(zoneId)
                    .orElseThrow(() -> new RuntimeException("Parking zone not found with ID: " + zoneId));
            if (!zone.getIsActive()) {
                throw new RuntimeException("Parking zone is not active");
            }
        } else {
            zone = detectParkingZone(latitude, longitude);
        }

        Double totalCost = zone.getPricePerHour() * hours;

        Wallet wallet = walletService.getOrCreateWallet(userId);
        if (wallet.getBalance() < totalCost) {
            throw new RuntimeException("Insufficient credits. Required: " + totalCost.intValue() + ", Available: "
                    + wallet.getBalance().intValue());
        }

        Transaction transaction = walletService.withdrawCredits(
                userId,
                totalCost,
                TransactionCategory.PARKING,
                "Parking payment " + zone.getName() + " - " + hours + " hour(s)",
                null);

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
                .latitude(latitude)
                .longitude(longitude)
                .startTime(startTime)
                .endTime(endTime)
                .hoursPaid(hours)
                .totalCost(totalCost)
                .isActive(true)
                .transaction(transaction)
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
