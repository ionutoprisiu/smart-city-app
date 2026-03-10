package com.example.backend.repository;

import com.example.backend.entity.ParkingZone;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ParkingZoneRepository extends JpaRepository<ParkingZone, Long> {

    List<ParkingZone> findByIsActiveTrue();

    Optional<ParkingZone> findByZoneNumberAndIsActiveTrue(Integer zoneNumber);
}
