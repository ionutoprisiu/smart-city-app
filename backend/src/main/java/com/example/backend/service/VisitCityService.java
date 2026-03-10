package com.example.backend.service;

import com.example.backend.dto.TouristAttractionResponse;
import com.example.backend.dto.RouteOptimizationResponse;
import com.example.backend.entity.AttractionCategory;
import com.example.backend.entity.TouristAttraction;
import com.example.backend.repository.TouristAttractionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class VisitCityService {

    private static final double CLUJ_CENTER_LAT = 46.7712;
    private static final double CLUJ_CENTER_LON = 23.5898;
    private static final double CLUJ_RADIUS_KM = 12.0;
    private static final String CLUJ = "Cluj-Napoca";

    private final TouristAttractionRepository attractionRepository;
    private final RouteOptimizationService routeOptimizationService;
    private final AttractionDiscoveryService attractionDiscoveryService;

    public List<TouristAttractionResponse> getAttractions(String category, String q) {
        if (category != null && !category.isBlank()) {
            return mapList(attractionRepository.findByCategoryAndIsActiveTrueOrderByNameAsc(
                    AttractionCategory.valueOf(category.toUpperCase())));
        }
        if (q != null && !q.isBlank()) {
            return mapList(attractionRepository.searchAttractions(q));
        }
        return mapList(attractionRepository.findByIsActiveTrueOrderByNameAsc());
    }

    public RouteOptimizationResponse optimizeRoute(List<Long> attractionIds, Double startLat, Double startLon) {
        return routeOptimizationService.optimizeRoute(attractionIds, startLat, startLon);
    }

    @Transactional
    public List<TouristAttractionResponse> getLiveAttractions(String q, Integer limit) {
        int cappedLimit = Math.max(1, Math.min(limit != null ? limit : 300, 500));
        String query = q != null ? q.trim().toLowerCase(Locale.ROOT) : "";

        List<TouristAttraction> discovered = attractionDiscoveryService
                .discoverAttractions(CLUJ_CENTER_LAT, CLUJ_CENTER_LON, CLUJ_RADIUS_KM);

        Set<String> seenNames = discovered.stream()
                .map(a -> a.getName() != null ? a.getName().trim().toLowerCase(Locale.ROOT) : "")
                .filter(name -> !name.isBlank())
                .collect(Collectors.toSet());

        List<TouristAttraction> normalized = discovered.stream()
                .filter(a -> a.getName() != null && !a.getName().isBlank())
                .filter(a -> query.isEmpty()
                        || a.getName().toLowerCase(Locale.ROOT).contains(query)
                        || (a.getDescription() != null && a.getDescription().toLowerCase(Locale.ROOT).contains(query)))
                .toList();

        // Ensure discovered attractions are persisted and get stable IDs for frontend selection/optimization.
        List<TouristAttraction> upserted = normalized.stream()
                .map(this::upsertAttraction)
                .toList();

        // Also include DB attractions that match the query but were not returned by Overpass now.
        List<TouristAttraction> dbMatches = query.isBlank()
                ? attractionRepository.findByIsActiveTrueOrderByNameAsc()
                : attractionRepository.searchAttractions(query);

        List<TouristAttraction> merged = upserted.stream()
                .collect(Collectors.toMap(
                        TouristAttraction::getId,
                        a -> a,
                        (a, b) -> a))
                .values()
                .stream()
                .toList();

        List<TouristAttraction> completed = dbMatches.stream()
                .filter(a -> !seenNames.contains(a.getName() != null ? a.getName().trim().toLowerCase(Locale.ROOT) : ""))
                .collect(Collectors.toCollection(java.util.ArrayList::new));
        completed.addAll(merged);

        List<TouristAttraction> sorted = completed.stream()
                .distinct()
                .sorted((a, b) -> a.getName().compareToIgnoreCase(b.getName()))
                .limit(cappedLimit)
                .toList();

        return mapList(sorted);
    }

    private TouristAttraction upsertAttraction(TouristAttraction discovered) {
        List<TouristAttraction> existing = attractionRepository.findNearbyByNameAndCity(
                discovered.getName(),
                CLUJ,
                discovered.getLatitude(),
                discovered.getLongitude()
        );
        return existing.isEmpty() ? attractionRepository.save(discovered) : existing.get(0);
    }

    private List<TouristAttractionResponse> mapList(List<TouristAttraction> attractions) {
        return attractions.stream().map(this::mapToResponse).toList();
    }

    private TouristAttractionResponse mapToResponse(TouristAttraction a) {
        return TouristAttractionResponse.builder()
                .id(a.getId())
                .name(a.getName())
                .description(a.getDescription())
                .latitude(a.getLatitude())
                .longitude(a.getLongitude())
                .city(a.getCity())
                .category(a.getCategory())
                .imageUrl(a.getImageUrl())
                .estimatedVisitTime(a.getEstimatedVisitTime())
                .isActive(a.getIsActive())
                .build();
    }
}
