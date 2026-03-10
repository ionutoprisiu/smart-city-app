package com.example.backend.repository;

import com.example.backend.entity.AttractionCategory;
import com.example.backend.entity.TouristAttraction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TouristAttractionRepository extends JpaRepository<TouristAttraction, Long> {

    List<TouristAttraction> findByIsActiveTrueOrderByNameAsc();

    List<TouristAttraction> findByCategoryAndIsActiveTrueOrderByNameAsc(AttractionCategory category);

    List<TouristAttraction> findByIdInAndIsActiveTrue(List<Long> ids);

    Optional<TouristAttraction> findFirstByNameIgnoreCaseAndCityIgnoreCase(String name, String city);

    @Query("""
           SELECT t FROM TouristAttraction t
           WHERE LOWER(t.name) = LOWER(:name)
             AND LOWER(t.city) = LOWER(:city)
             AND ABS(t.latitude - :lat) < 0.0005
             AND ABS(t.longitude - :lon) < 0.0005
           ORDER BY t.id ASC
           """)
    List<TouristAttraction> findNearbyByNameAndCity(
            @Param("name") String name,
            @Param("city") String city,
            @Param("lat") double lat,
            @Param("lon") double lon
    );

    @Query("SELECT t FROM TouristAttraction t WHERE t.isActive = true AND " +
           "(LOWER(t.name) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(t.description) LIKE LOWER(CONCAT('%', :query, '%'))) " +
           "ORDER BY t.name ASC")
    List<TouristAttraction> searchAttractions(@Param("query") String query);
}
