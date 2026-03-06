package com.example.backend.parking.repository;

import com.example.backend.parking.entity.ParkingZone;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ParkingZoneRepository extends JpaRepository<ParkingZone, Long> {

    List<ParkingZone> findByIsActiveTrue();

    Optional<ParkingZone> findByZoneNumberAndIsActiveTrue(Integer zoneNumber);

    List<ParkingZone> findByIsActiveTrueAndMinLatitudeLessThanEqualAndMaxLatitudeGreaterThanEqualAndMinLongitudeLessThanEqualAndMaxLongitudeGreaterThanEqual(
            Double latitude, Double latitude2, Double longitude, Double longitude2);
}
