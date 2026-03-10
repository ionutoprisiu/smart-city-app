package com.example.backend.repository;

import com.example.backend.entity.ParkingSession;
import com.example.backend.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface ParkingSessionRepository extends JpaRepository<ParkingSession, Long> {

    Optional<ParkingSession> findByUserAndIsActiveTrue(User user);

    List<ParkingSession> findByUserAndIsActiveTrueOrderByCreatedAtDesc(User user);

    List<ParkingSession> findByUserOrderByCreatedAtDesc(User user);

    @Query("SELECT ps FROM ParkingSession ps WHERE ps.isActive = true AND ps.endTime BETWEEN :now AND :futureTime")
    List<ParkingSession> findExpiringSessions(@Param("now") LocalDateTime now, @Param("futureTime") LocalDateTime futureTime);

    @Query("SELECT ps FROM ParkingSession ps WHERE ps.isActive = true AND ps.endTime < :now")
    List<ParkingSession> findExpiredSessions(@Param("now") LocalDateTime now);
}
