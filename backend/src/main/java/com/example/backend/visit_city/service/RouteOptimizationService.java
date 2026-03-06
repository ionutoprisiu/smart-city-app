package com.example.backend.visit_city.service;

import com.example.backend.visit_city.dto.RouteOptimizationRequest;
import com.example.backend.visit_city.dto.RouteOptimizationResponse;
import com.example.backend.visit_city.entity.TouristAttraction;
import com.example.backend.visit_city.repository.TouristAttractionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Service for optimizing routes using the Python ACO service.
 *
 * Communicates with a Python FastAPI service that implements
 * the Ant Colony Optimization algorithm for tourist route optimization.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class RouteOptimizationService {
    
    private static final String OPTIMIZE_ENDPOINT = "/optimize";
    private static final int MIN_ATTRACTIONS = 2;
    
    @Value("${aco.service.url:http://localhost:8000}")
    private String acoServiceUrl;
    
    private final TouristAttractionRepository attractionRepository;
    private final RestTemplate restTemplate = new RestTemplate();
    
    /**
     * Optimizes a route using the Python ACO service.
     *
     * @param attractionIds list of attraction IDs to visit
     * @param startLatitude latitude of the starting point (optional)
     * @param startLongitude longitude of the starting point (optional)
     * @return optimized route with steps, total distance and estimated time
     * @throws IllegalArgumentException if the number of attractions is invalid
     * @throws RuntimeException if a communication error occurs with the Python service
     */
    public RouteOptimizationResponse optimizeRoute(
            List<Long> attractionIds,
            Double startLatitude,
            Double startLongitude) {
        
        validateRequest(attractionIds);
        
        try {
            log.info("Optimizing route for {} attractions", attractionIds.size());
            
            List<TouristAttraction> attractions = findAttractions(attractionIds);
            
            RouteOptimizationRequest request = buildOptimizationRequest(
                    attractions, startLatitude, startLongitude);
            
            RouteOptimizationResponse response = callACOService(request);
            
            enrichResponseWithAttractionNames(response, attractions);
            
            log.info(
                    "Route optimized successfully: {} km, {} min, {} steps",
                    response.getTotalDistance(),
                    response.getTotalTime(),
                    response.getSteps().size()
            );
            
            return response;
            
        } catch (IllegalArgumentException e) {
            log.error("Invalid request: {}", e.getMessage());
            throw e;
        } catch (ResourceAccessException e) {
            log.error("Cannot connect to ACO service at {}: {}", acoServiceUrl, e.getMessage());
            throw new RuntimeException(
                    "ACO service is not available. Please ensure the Python service is running.",
                    e
            );
        } catch (HttpClientErrorException e) {
            log.error("ACO service returned client error ({}): {}", e.getStatusCode(), e.getMessage());
            throw new RuntimeException(
                    "Invalid request to ACO service: " + e.getMessage(),
                    e
            );
        } catch (HttpServerErrorException e) {
            log.error("ACO service returned server error ({}): {}", e.getStatusCode(), e.getMessage());
            throw new RuntimeException(
                    "ACO service error: " + e.getMessage(),
                    e
            );
        } catch (Exception e) {
            log.error("Unexpected error optimizing route: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to optimize route: " + e.getMessage(), e);
        }
    }
    
    private void validateRequest(List<Long> attractionIds) {
        if (attractionIds == null || attractionIds.size() < MIN_ATTRACTIONS) {
            throw new IllegalArgumentException("At least 2 attractions required");
        }
    }
    
    private List<TouristAttraction> findAttractions(List<Long> attractionIds) {
        List<TouristAttraction> attractions = attractionRepository.findByIdInAndIsActiveTrue(attractionIds);
        
        if (attractions.size() != attractionIds.size()) {
            List<Long> foundIds = attractions.stream()
                    .map(TouristAttraction::getId)
                    .collect(Collectors.toList());
            List<Long> missingIds = attractionIds.stream()
                    .filter(id -> !foundIds.contains(id))
                    .collect(Collectors.toList());
            
            throw new IllegalArgumentException(
                    String.format("Some attractions not found: %s", missingIds)
            );
        }
        
        return attractions;
    }
    
    private RouteOptimizationRequest buildOptimizationRequest(
            List<TouristAttraction> attractions,
            Double startLatitude,
            Double startLongitude) {
        
        List<RouteOptimizationRequest.AttractionData> attractionData = attractions.stream()
                .map(attr -> RouteOptimizationRequest.AttractionData.builder()
                        .id(attr.getId())
                        .latitude(attr.getLatitude())
                        .longitude(attr.getLongitude())
                        .visitTime(attr.getEstimatedVisitTime())
                        .build())
                .collect(Collectors.toList());
        
        return RouteOptimizationRequest.builder()
                .attractions(attractionData)
                .startLatitude(startLatitude)
                .startLongitude(startLongitude)
                .build();
    }
    
    private RouteOptimizationResponse callACOService(RouteOptimizationRequest request) {
        String url = acoServiceUrl + OPTIMIZE_ENDPOINT;
        
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        
        Map<String, Object> requestBody = buildRequestBody(request);
        
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);
        
        log.debug("Calling ACO service at: {}", url);
        
        try {
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    entity,
                    new ParameterizedTypeReference<Map<String, Object>>() {}
            );
            
            Map<String, Object> responseBody = response.getBody();
            if (responseBody == null) {
                throw new RuntimeException("Empty response from ACO service");
            }
            
            return parseACOResponse(responseBody);
            
        } catch (ResourceAccessException e) {
            log.error("Connection error: {}", e.getMessage());
            throw new RuntimeException(
                    "Cannot connect to ACO service. Is it running?",
                    e
            );
        }
    }
    
    private Map<String, Object> buildRequestBody(RouteOptimizationRequest request) {
        Map<String, Object> requestBody = new HashMap<>();
        
        requestBody.put("attractions", request.getAttractions().stream()
                .map(attr -> {
                    Map<String, Object> attrMap = new HashMap<>();
                    attrMap.put("id", attr.getId());
                    attrMap.put("latitude", attr.getLatitude());
                    attrMap.put("longitude", attr.getLongitude());
                    attrMap.put("visitTime", attr.getVisitTime());
                    return attrMap;
                })
                .collect(Collectors.toList()));
        
        if (request.getStartLatitude() != null) {
            requestBody.put("startLatitude", request.getStartLatitude());
        }
        if (request.getStartLongitude() != null) {
            requestBody.put("startLongitude", request.getStartLongitude());
        }
        
        return requestBody;
    }
    
    @SuppressWarnings("unchecked")
    private RouteOptimizationResponse parseACOResponse(Map<String, Object> responseBody) {
        List<Map<String, Object>> stepsData = (List<Map<String, Object>>) responseBody.get("steps");
        if (stepsData == null) {
            throw new RuntimeException("Invalid response: missing 'steps' field");
        }
        
        List<RouteOptimizationResponse.RouteStepData> steps = stepsData.stream()
                .map(this::parseStepData)
                .collect(Collectors.toList());
        
        List<Map<String, Double>> path = (List<Map<String, Double>>) responseBody.get("path");
        if (path == null) {
            throw new RuntimeException("Invalid response: missing 'path' field");
        }
        
        Object totalDistanceObj = responseBody.get("totalDistance");
        Object totalTimeObj = responseBody.get("totalTime");
        
        if (totalDistanceObj == null || totalTimeObj == null) {
            throw new RuntimeException("Invalid response: missing distance or time");
        }
        
        return RouteOptimizationResponse.builder()
                .steps(steps)
                .totalDistance(((Number) totalDistanceObj).doubleValue())
                .totalTime(((Number) totalTimeObj).intValue())
                .path(path)
                .build();
    }
    
    private RouteOptimizationResponse.RouteStepData parseStepData(Map<String, Object> stepMap) {
        Double distanceToNext = stepMap.get("distanceToNext") != null
                ? ((Number) stepMap.get("distanceToNext")).doubleValue()
                : null;
        
        Integer estimatedVisitTime = stepMap.get("estimatedVisitTime") != null
                ? ((Number) stepMap.get("estimatedVisitTime")).intValue()
                : null;
        
        return RouteOptimizationResponse.RouteStepData.builder()
                .order(((Number) stepMap.get("order")).intValue())
                .attractionId(((Number) stepMap.get("attractionId")).longValue())
                .attractionName((String) stepMap.get("attractionName"))
                .latitude(((Number) stepMap.get("latitude")).doubleValue())
                .longitude(((Number) stepMap.get("longitude")).doubleValue())
                .distanceToNext(distanceToNext)
                .estimatedVisitTime(estimatedVisitTime)
                .build();
    }
    
    private void enrichResponseWithAttractionNames(
            RouteOptimizationResponse response,
            List<TouristAttraction> attractions) {
        
        Map<Long, TouristAttraction> attractionMap = attractions.stream()
                .collect(Collectors.toMap(TouristAttraction::getId, attr -> attr));
        
        for (RouteOptimizationResponse.RouteStepData step : response.getSteps()) {
            TouristAttraction attraction = attractionMap.get(step.getAttractionId());
            if (attraction != null) {
                step.setAttractionName(attraction.getName());
            } else {
                log.warn("Attraction not found for ID: {}", step.getAttractionId());
            }
        }
    }
}
