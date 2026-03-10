package com.example.backend.repository;

import com.example.backend.entity.Issue;
import com.example.backend.entity.IssueStatus;
import com.example.backend.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface IssueRepository extends JpaRepository<Issue, Long> {

    List<Issue> findByCreatedByOrderByCreatedAtDesc(User user);

    List<Issue> findByStatusOrderByCreatedAtDesc(IssueStatus status);

    List<Issue> findByAssignedOperatorOrderByCreatedAtDesc(User operator);

    List<Issue> findByCreatedByAndStatusOrderByCreatedAtDesc(User user, IssueStatus status);

    @Query("SELECT i FROM Issue i ORDER BY i.createdAt DESC")
    List<Issue> findAllOrderByCreatedAtDesc();

    long countByStatus(IssueStatus status);

    @Query("SELECT i FROM Issue i WHERE " +
            "(6371 * acos(cos(radians(:lat)) * cos(radians(i.latitude)) * " +
            "cos(radians(i.longitude) - radians(:lng)) + sin(radians(:lat)) * " +
            "sin(radians(i.latitude)))) <= :radius " +
            "ORDER BY i.createdAt DESC")
    List<Issue> findNearbyIssues(@Param("lat") double latitude,
            @Param("lng") double longitude,
            @Param("radius") double radiusKm);
}
