package com.example.backend.visit_city.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

/**
 * Service for detecting cities from GPS coordinates using reverse geocoding.
 * Uses the OpenStreetMap Nominatim API (free, no API key required).
 */
@Service
@Slf4j
public class CityDetectionService {
    
    private static final String NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";
    private final RestTemplate restTemplate;
    
    public CityDetectionService() {
        this.restTemplate = new RestTemplate();
    }
    
    /**
     * Detects the city from GPS coordinates using reverse geocoding.
     *
     * @param latitude latitude
     * @param longitude longitude
     * @return city name or null if it cannot be detected
     */
    public String detectCity(double latitude, double longitude) {
        try {
            String url = String.format(
                "%s?format=json&lat=%.6f&lon=%.6f&zoom=10&addressdetails=1",
                NOMINATIM_URL, latitude, longitude
            );
            
            org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
            headers.set("User-Agent", "SmartCityApp/1.0");
            org.springframework.http.HttpEntity<?> entity = new org.springframework.http.HttpEntity<>(headers);
            
            @SuppressWarnings("unchecked")
            Map<String, Object> response = (Map<String, Object>) restTemplate.exchange(
                url,
                org.springframework.http.HttpMethod.GET,
                entity,
                Map.class
            ).getBody();
            
            if (response != null && response.containsKey("address")) {
                @SuppressWarnings("unchecked")
                Map<String, Object> address = (Map<String, Object>) response.get("address");
                
                String city = extractCityName(address);
                
                if (city != null) {
                    log.info("City detected: {} for coordinates ({}, {})", city, latitude, longitude);
                    return city;
                }
            }
            
            log.warn("Could not detect city for coordinates ({}, {})", latitude, longitude);
            return null;
            
        } catch (Exception e) {
            log.error("Error detecting city from coordinates ({}, {}): {}", latitude, longitude, e.getMessage());
            return null;
        }
    }
    
    /**
     * Extracts the city name from the address object.
     * Checks multiple fields: city, town, municipality, county
     */
    private String extractCityName(Map<String, Object> address) {
        String[] cityFields = {"city", "town", "municipality", "county", "village"};
        
        for (String field : cityFields) {
            Object value = address.get(field);
            if (value != null) {
                String cityName = value.toString();
                if (!cityName.isEmpty()) {
                    return cityName;
                }
            }
        }
        
        return null;
    }
}
