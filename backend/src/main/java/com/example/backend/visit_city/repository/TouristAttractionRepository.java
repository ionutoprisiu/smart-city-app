package com.example.backend.visit_city.repository;

import com.example.backend.visit_city.entity.AttractionCategory;
import com.example.backend.visit_city.entity.TouristAttraction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TouristAttractionRepository extends JpaRepository<TouristAttraction, Long> {
    
    List<TouristAttraction> findByIsActiveTrueOrderByNameAsc();
    
    List<TouristAttraction> findByCityAndIsActiveTrueOrderByNameAsc(String city);
    
    List<TouristAttraction> findByCategoryAndIsActiveTrueOrderByNameAsc(AttractionCategory category);
    
    List<TouristAttraction> findByCityAndCategoryAndIsActiveTrueOrderByNameAsc(String city, AttractionCategory category);
    
    List<TouristAttraction> findByIdInAndIsActiveTrue(List<Long> ids);
    
    @Query("SELECT t FROM TouristAttraction t WHERE t.isActive = true AND " +
           "(LOWER(t.name) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(t.description) LIKE LOWER(CONCAT('%', :query, '%'))) " +
           "ORDER BY t.name ASC")
    List<TouristAttraction> searchAttractions(@Param("query") String query);
    
    @Query("SELECT t FROM TouristAttraction t WHERE t.isActive = true AND " +
           "(6371 * acos(cos(radians(:lat)) * cos(radians(t.latitude)) * " +
           "cos(radians(t.longitude) - radians(:lng)) + sin(radians(:lat)) * " +
           "sin(radians(t.latitude)))) <= :radius " +
           "ORDER BY t.name ASC")
    List<TouristAttraction> findNearbyAttractions(
            @Param("lat") double latitude,
            @Param("lng") double longitude,
            @Param("radius") double radiusKm);
}
