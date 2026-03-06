package com.example.backend.visit_city.service;

import com.example.backend.visit_city.dto.TouristAttractionResponse;
import com.example.backend.visit_city.entity.AttractionCategory;
import com.example.backend.visit_city.entity.TouristAttraction;
import com.example.backend.visit_city.repository.TouristAttractionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class VisitCityService {
    
    private final TouristAttractionRepository attractionRepository;
    private final CityDetectionService cityDetectionService;
    private final AttractionDiscoveryService attractionDiscoveryService;
    private final RouteOptimizationService routeOptimizationService;
    
    public List<TouristAttractionResponse> getAttractions(
            Double latitude, Double longitude, String city, String category, String q) {
        if (latitude != null && longitude != null) return getAttractionsByLocation(latitude, longitude);
        if (city != null && !city.isBlank()) return getAttractionsByCity(city);
        if (category != null && !category.isBlank()) {
            AttractionCategory cat = AttractionCategory.valueOf(category.toUpperCase());
            return getAttractionsByCategory(cat);
        }
        if (q != null && !q.isBlank()) return searchAttractions(q);
        return getAllAttractions();
    }

    public List<TouristAttractionResponse> getAllAttractions() {
        List<TouristAttraction> attractions = attractionRepository.findByIsActiveTrueOrderByNameAsc();
        return attractions.stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }
    
    /**
     * Detects the city from GPS coordinates and returns attractions from that city.
     * If no attractions exist in the database, discovers them automatically from OpenStreetMap.
     */
    public List<TouristAttractionResponse> getAttractionsByLocation(double latitude, double longitude) {
        String city = cityDetectionService.detectCity(latitude, longitude);
        
        if (city == null) {
            return getNearbyAttractions(latitude, longitude, 10.0);
        }
        
        List<TouristAttraction> dbAttractions = attractionRepository.findByCityAndIsActiveTrueOrderByNameAsc(city);
        
        if (dbAttractions.isEmpty()) {
            log.info("No attractions in database for city: {}. Discovering automatically...", city);
            List<TouristAttraction> discovered = attractionDiscoveryService.discoverAttractions(
                    latitude, longitude, 5.0);
            
            if (!discovered.isEmpty()) {
                attractionRepository.saveAll(discovered);
                log.info("Saved {} discovered attractions to database", discovered.size());
            }
            
            return discovered.stream()
                    .map(this::mapToResponse)
                    .collect(Collectors.toList());
        }
        
        return dbAttractions.stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }
    
    /**
     * Discovers attractions automatically in the specified area (without saving to the database).
     */
    public List<TouristAttractionResponse> discoverAttractions(double latitude, double longitude, double radiusKm) {
        List<TouristAttraction> discovered = attractionDiscoveryService.discoverAttractions(
                latitude, longitude, radiusKm);
        
        return discovered.stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }
    
    /**
     * Optimizes a route using ACO.
     */
    public com.example.backend.visit_city.dto.RouteOptimizationResponse optimizeRoute(
            List<Long> attractionIds,
            Double startLatitude,
            Double startLongitude) {
        return routeOptimizationService.optimizeRoute(attractionIds, startLatitude, startLongitude);
    }
    
    public List<TouristAttractionResponse> getAttractionsByCity(String city) {
        List<TouristAttraction> attractions = attractionRepository.findByCityAndIsActiveTrueOrderByNameAsc(city);
        return attractions.stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }
    
    public List<TouristAttractionResponse> getAttractionsByCityAndCategory(String city, AttractionCategory category) {
        List<TouristAttraction> attractions = attractionRepository.findByCityAndCategoryAndIsActiveTrueOrderByNameAsc(city, category);
        return attractions.stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }
    
    public List<TouristAttractionResponse> getAttractionsByCategory(AttractionCategory category) {
        List<TouristAttraction> attractions = attractionRepository.findByCategoryAndIsActiveTrueOrderByNameAsc(category);
        return attractions.stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }
    
    public List<TouristAttractionResponse> getAttractionsByIds(List<Long> ids) {
        List<TouristAttraction> attractions = attractionRepository.findByIdInAndIsActiveTrue(ids);
        return attractions.stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }
    
    public List<TouristAttractionResponse> searchAttractions(String query) {
        List<TouristAttraction> attractions = attractionRepository.searchAttractions(query);
        return attractions.stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }
    
    public List<TouristAttractionResponse> getNearbyAttractions(double latitude, double longitude, double radiusKm) {
        List<TouristAttraction> attractions = attractionRepository.findNearbyAttractions(latitude, longitude, radiusKm);
        return attractions.stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }
    
    private TouristAttractionResponse mapToResponse(TouristAttraction attraction) {
        return TouristAttractionResponse.builder()
                .id(attraction.getId())
                .name(attraction.getName())
                .description(attraction.getDescription())
                .latitude(attraction.getLatitude())
                .longitude(attraction.getLongitude())
                .city(attraction.getCity())
                .category(attraction.getCategory())
                .imageUrl(attraction.getImageUrl())
                .estimatedVisitTime(attraction.getEstimatedVisitTime())
                .isActive(attraction.getIsActive())
                .build();
    }
}
