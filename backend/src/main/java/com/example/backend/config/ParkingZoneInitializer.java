package com.example.backend.config;

import com.example.backend.parking.entity.ParkingZone;
import com.example.backend.parking.repository.ParkingZoneRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@RequiredArgsConstructor
public class ParkingZoneInitializer implements CommandLineRunner {

    private final ParkingZoneRepository parkingZoneRepository;

    @Override
    public void run(String... args) {
        if (parkingZoneRepository.count() > 0) {
            return;
        }

        ParkingZone zone1 = ParkingZone.builder()
                .name("Zone 1 - Downtown")
                .zoneNumber(1)
                .pricePerHour(800.0) // 8 RON/hour = 800 ClujCoins
                .minLatitude(46.7650)
                .maxLatitude(46.7800)
                .minLongitude(23.5700)
                .maxLongitude(23.6000)
                .description("Central zone - historic center of Cluj-Napoca")
                .isActive(true)
                .build();

        ParkingZone zone2 = ParkingZone.builder()
                .name("Zone 2 - Suburbs")
                .zoneNumber(2)
                .pricePerHour(400.0) // 4 RON/hour = 400 ClujCoins
                .minLatitude(46.7000)
                .maxLatitude(46.8500)
                .minLongitude(23.5000)
                .maxLongitude(23.7000)
                .description("Suburban zone - rest of Cluj-Napoca")
                .isActive(true)
                .build();

        parkingZoneRepository.saveAll(List.of(zone1, zone2));
    }
}
