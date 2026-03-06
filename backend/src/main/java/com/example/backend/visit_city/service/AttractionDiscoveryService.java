package com.example.backend.visit_city.service;

import com.example.backend.visit_city.entity.AttractionCategory;
import com.example.backend.visit_city.entity.TouristAttraction;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Service for automatic discovery of tourist attractions using OpenStreetMap.
 * Uses the Overpass API to find attractions in a specified area.
 */
@Service
@Slf4j
public class AttractionDiscoveryService {
    
    private static final String OVERPASS_API_URL = "https://overpass-api.de/api/interpreter";
    private final RestTemplate restTemplate;
    private final CityDetectionService cityDetectionService;
    
    public AttractionDiscoveryService(CityDetectionService cityDetectionService) {
        this.restTemplate = new RestTemplate();
        this.cityDetectionService = cityDetectionService;
    }
    
    /**
     * Automatically discovers tourist attractions in the specified area.
     *
     * @param latitude center latitude
     * @param longitude center longitude
     * @param radiusKm search radius in kilometers
     * @return list of discovered attractions
     */
    public List<TouristAttraction> discoverAttractions(double latitude, double longitude, double radiusKm) {
        try {
            String city = cityDetectionService.detectCity(latitude, longitude);
            if (city == null) {
                city = "Unknown";
            }
            
            log.info("Discovering attractions near ({}, {}) in city: {}", latitude, longitude, city);
            
            String query = buildOverpassQuery(latitude, longitude, radiusKm);
            
            Map<String, Object> response = executeOverpassQuery(query);
            
            List<TouristAttraction> attractions = parseOverpassResponse(response, city);
            
            log.info("Discovered {} attractions", attractions.size());
            return attractions;
            
        } catch (Exception e) {
            log.error("Error discovering attractions: {}", e.getMessage(), e);
            return new ArrayList<>();
        }
    }
    
    /**
     * Builds an Overpass query to find tourist attractions.
     * Searches: tourism, amenity (restaurant, cafe, etc.), historic, leisure
     */
    private String buildOverpassQuery(double lat, double lon, double radiusKm) {
        double radiusDegrees = radiusKm / 111.0;
        
        return String.format(
            "[out:json][timeout:25];" +
            "(" +
            "  node[\"tourism\"][\"name\"](around:%f,%f,%f);" +
            "  way[\"tourism\"][\"name\"](around:%f,%f,%f);" +
            "  node[\"amenity\"=\"restaurant\"][\"name\"](around:%f,%f,%f);" +
            "  node[\"amenity\"=\"cafe\"][\"name\"](around:%f,%f,%f);" +
            "  node[\"amenity\"=\"museum\"][\"name\"](around:%f,%f,%f);" +
            "  node[\"amenity\"=\"theatre\"][\"name\"](around:%f,%f,%f);" +
            "  node[\"historic\"][\"name\"](around:%f,%f,%f);" +
            "  way[\"historic\"][\"name\"](around:%f,%f,%f);" +
            "  node[\"leisure\"=\"park\"][\"name\"](around:%f,%f,%f);" +
            "  way[\"leisure\"=\"park\"][\"name\"](around:%f,%f,%f);" +
            "  node[\"amenity\"=\"place_of_worship\"][\"name\"](around:%f,%f,%f);" +
            "  way[\"amenity\"=\"place_of_worship\"][\"name\"](around:%f,%f,%f);" +
            ");" +
            "out center meta;",
            radiusDegrees * 1000, lat, lon,
            radiusDegrees * 1000, lat, lon,
            radiusDegrees * 1000, lat, lon,
            radiusDegrees * 1000, lat, lon,
            radiusDegrees * 1000, lat, lon,
            radiusDegrees * 1000, lat, lon,
            radiusDegrees * 1000, lat, lon,
            radiusDegrees * 1000, lat, lon,
            radiusDegrees * 1000, lat, lon,
            radiusDegrees * 1000, lat, lon,
            radiusDegrees * 1000, lat, lon,
            radiusDegrees * 1000, lat, lon,
            radiusDegrees * 1000, lat, lon
        );
    }
    
    @SuppressWarnings("unchecked")
    private Map<String, Object> executeOverpassQuery(String query) {
        org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
        headers.set("User-Agent", "SmartCityApp/1.0");
        headers.set("Content-Type", "application/x-www-form-urlencoded");
        
        org.springframework.http.HttpEntity<String> entity = new org.springframework.http.HttpEntity<>(query, headers);
        
        Map<String, Object> response = restTemplate.exchange(
            OVERPASS_API_URL,
            org.springframework.http.HttpMethod.POST,
            entity,
            Map.class
        ).getBody();
        
        return response != null ? response : Map.of();
    }
    
    @SuppressWarnings("unchecked")
    private List<TouristAttraction> parseOverpassResponse(Map<String, Object> response, String city) {
        List<TouristAttraction> attractions = new ArrayList<>();
        
        try {
            List<Map<String, Object>> elements = (List<Map<String, Object>>) response.get("elements");
            if (elements == null) {
                return attractions;
            }
            
            for (Map<String, Object> element : elements) {
                try {
                    TouristAttraction attraction = parseElement(element, city);
                    if (attraction != null) {
                        attractions.add(attraction);
                    }
                } catch (Exception e) {
                    log.warn("Error parsing element: {}", e.getMessage());
                }
            }
        } catch (Exception e) {
            log.error("Error parsing Overpass response: {}", e.getMessage());
        }
        
        return attractions;
    }
    
    @SuppressWarnings("unchecked")
    private TouristAttraction parseElement(Map<String, Object> element, String city) {
        Map<String, Object> tags = (Map<String, Object>) element.get("tags");
        if (tags == null || !tags.containsKey("name")) {
            return null;
        }
        
        String name = (String) tags.get("name");
        if (name == null || name.isEmpty()) {
            return null;
        }
        
        Double lat = null;
        Double lon = null;
        
        if (element.containsKey("lat") && element.containsKey("lon")) {
            lat = ((Number) element.get("lat")).doubleValue();
            lon = ((Number) element.get("lon")).doubleValue();
        } else if (element.containsKey("center")) {
            Map<String, Object> center = (Map<String, Object>) element.get("center");
            if (center != null) {
                lat = ((Number) center.get("lat")).doubleValue();
                lon = ((Number) center.get("lon")).doubleValue();
            }
        }
        
        if (lat == null || lon == null) {
            return null;
        }
        
        AttractionCategory category = determineCategory(tags);
        
        String description = (String) tags.getOrDefault("description", 
            tags.getOrDefault("tourism", tags.getOrDefault("amenity", "")));
        
        Integer visitTime = estimateVisitTime(category);
        
        return TouristAttraction.builder()
                .name(name)
                .description(description != null ? description : "")
                .latitude(lat)
                .longitude(lon)
                .city(city)
                .category(category)
                .estimatedVisitTime(visitTime)
                .isActive(true)
                .build();
    }
    
    /**
     * Determines the attraction category based on OSM tags.
     */
    private AttractionCategory determineCategory(Map<String, Object> tags) {
        String tourism = (String) tags.get("tourism");
        if (tourism != null) {
            switch (tourism.toLowerCase()) {
                case "museum": return AttractionCategory.MUSEUM;
                case "attraction": return AttractionCategory.MONUMENT;
                case "hotel": return AttractionCategory.HOTEL;
            }
        }
        
        String amenity = (String) tags.get("amenity");
        if (amenity != null) {
            switch (amenity.toLowerCase()) {
                case "restaurant": return AttractionCategory.RESTAURANT;
                case "cafe": return AttractionCategory.CAFE;
                case "museum": return AttractionCategory.MUSEUM;
                case "theatre": return AttractionCategory.THEATER;
                case "place_of_worship": return AttractionCategory.CHURCH;
            }
        }
        
        if (tags.containsKey("historic")) {
            return AttractionCategory.MONUMENT;
        }
        
        String leisure = (String) tags.get("leisure");
        if ("park".equals(leisure)) {
            return AttractionCategory.PARK;
        }
        
        return AttractionCategory.OTHER;
    }
    
    /**
     * Estimates visit time based on category.
     */
    private Integer estimateVisitTime(AttractionCategory category) {
        return switch (category) {
            case MUSEUM -> 90;
            case RESTAURANT -> 60;
            case CAFE -> 30;
            case PARK -> 45;
            case CHURCH -> 30;
            case THEATER -> 120;
            case MONUMENT -> 30;
            default -> 30;
        };
    }
}
