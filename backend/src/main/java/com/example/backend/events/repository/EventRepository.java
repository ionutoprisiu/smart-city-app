package com.example.backend.events.repository;

import com.example.backend.events.entity.Event;
import com.example.backend.events.entity.EventCategory;
import com.example.backend.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface EventRepository extends JpaRepository<Event, Long> {
    
    @Query("SELECT e FROM Event e WHERE e.isActive = true ORDER BY e.startDateTime ASC")
    List<Event> findAllActiveOrderByStartDateTime();
    
    @Query("SELECT e FROM Event e WHERE e.isActive = true AND e.startDateTime >= :now ORDER BY e.startDateTime ASC")
    List<Event> findUpcomingEvents(@Param("now") LocalDateTime now);
    
    List<Event> findByCreatedByOrderByCreatedAtDesc(User organizer);
    
    List<Event> findByCategoryAndIsActiveTrueOrderByStartDateTimeAsc(EventCategory category);
    
    @Query("SELECT e FROM Event e WHERE e.isActive = true AND e.startDateTime >= :start AND e.startDateTime <= :end ORDER BY e.startDateTime ASC")
    List<Event> findEventsBetweenDates(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);
    
    @Query("SELECT e FROM Event e WHERE e.isActive = true AND " +
           "(LOWER(e.title) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(e.description) LIKE LOWER(CONCAT('%', :query, '%'))) " +
           "ORDER BY e.startDateTime ASC")
    List<Event> searchEvents(@Param("query") String query);
}
