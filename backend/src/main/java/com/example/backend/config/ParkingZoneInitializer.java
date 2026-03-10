package com.example.backend.config;

import com.example.backend.entity.ParkingZone;
import com.example.backend.repository.ParkingZoneRepository;
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
        if (parkingZoneRepository.count() > 0) return;

        ParkingZone zone1 = ParkingZone.builder()
                .name("Zone 1 - Downtown")
                .zoneNumber(1)
                .pricePerHour(8.0)
                .minLatitude(46.7650)
                .maxLatitude(46.7800)
                .minLongitude(23.5700)
                .maxLongitude(23.6000)
                .description("Central zone - downtown Cluj-Napoca")
                .isActive(true)
                .build();

        ParkingZone zone2 = ParkingZone.builder()
                .name("Zone 2 - Neighborhoods")
                .zoneNumber(2)
                .pricePerHour(3.0)
                .minLatitude(46.7400)
                .maxLatitude(46.8000)
                .minLongitude(23.5400)
                .maxLongitude(23.6400)
                .description("Neighborhood zone - residential areas of Cluj-Napoca")
                .isActive(true)
                .build();

        parkingZoneRepository.saveAll(List.of(zone1, zone2));
    }
}
