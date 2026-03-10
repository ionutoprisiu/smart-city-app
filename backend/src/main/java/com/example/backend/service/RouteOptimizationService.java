package com.example.backend.service;

import com.example.backend.dto.RouteOptimizationRequest;
import com.example.backend.dto.RouteOptimizationResponse;
import com.example.backend.entity.TouristAttraction;
import com.example.backend.repository.TouristAttractionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class RouteOptimizationService {

    @Value("${aco.service.url:http://localhost:8000}")
    private String acoServiceUrl;

    private final TouristAttractionRepository attractionRepository;
    private final RestTemplate restTemplate = new RestTemplate();

    public RouteOptimizationResponse optimizeRoute(List<Long> attractionIds, Double startLat, Double startLon) {
        if (attractionIds == null || attractionIds.isEmpty()) {
            throw new IllegalArgumentException("At least 1 attraction required");
        }
        boolean hasStart = startLat != null && startLon != null;
        if (attractionIds.size() < 2 && !hasStart) {
            throw new IllegalArgumentException("Provide at least 2 attractions, or 1 attraction with a start location");
        }

        try {
            List<TouristAttraction> attractions = findAttractions(attractionIds);
            RouteOptimizationRequest request = buildRequest(attractions, startLat, startLon);
            RouteOptimizationResponse response = callACOService(request);
            enrichWithNames(response, attractions);

            log.info("Route optimized: {} km, {} min", response.getTotalDistance(), response.getTotalTime());
            return response;

        } catch (IllegalArgumentException e) {
            throw e;
        } catch (ResourceAccessException e) {
            throw new RuntimeException("ACO service is not available. Is the Python service running?", e);
        } catch (HttpClientErrorException | HttpServerErrorException e) {
            throw new RuntimeException("ACO service error: " + e.getMessage(), e);
        } catch (Exception e) {
            throw new RuntimeException("Failed to optimize route: " + e.getMessage(), e);
        }
    }

    private List<TouristAttraction> findAttractions(List<Long> ids) {
        List<TouristAttraction> attractions = attractionRepository.findByIdInAndIsActiveTrue(ids);
        if (attractions.size() != ids.size()) {
            List<Long> foundIds = attractions.stream().map(TouristAttraction::getId).toList();
            List<Long> missing = ids.stream().filter(id -> !foundIds.contains(id)).toList();
            throw new IllegalArgumentException("Attractions not found: " + missing);
        }
        return attractions;
    }

    private RouteOptimizationRequest buildRequest(List<TouristAttraction> attractions, Double startLat, Double startLon) {
        List<RouteOptimizationRequest.AttractionData> data = attractions.stream()
                .map(a -> RouteOptimizationRequest.AttractionData.builder()
                        .id(a.getId())
                        .latitude(a.getLatitude())
                        .longitude(a.getLongitude())
                        .visitTime(a.getEstimatedVisitTime())
                        .build())
                .toList();

        return RouteOptimizationRequest.builder()
                .attractions(data)
                .startLatitude(startLat)
                .startLongitude(startLon)
                .build();
    }

    private RouteOptimizationResponse callACOService(RouteOptimizationRequest request) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> body = new HashMap<>();
        body.put("attractions", request.getAttractions().stream()
                .map(a -> Map.of(
                        "id", (Object) a.getId(),
                        "latitude", a.getLatitude(),
                        "longitude", a.getLongitude(),
                        "visitTime", a.getVisitTime()))
                .toList());
        if (request.getStartLatitude() != null) body.put("startLatitude", request.getStartLatitude());
        if (request.getStartLongitude() != null) body.put("startLongitude", request.getStartLongitude());

        ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                acoServiceUrl + "/optimize",
                HttpMethod.POST,
                new HttpEntity<>(body, headers),
                new ParameterizedTypeReference<>() {}
        );

        Map<String, Object> responseBody = response.getBody();
        if (responseBody == null) throw new RuntimeException("Empty response from ACO service");
        return parseResponse(responseBody);
    }

    @SuppressWarnings("unchecked")
    private RouteOptimizationResponse parseResponse(Map<String, Object> body) {
        List<Map<String, Object>> stepsData = (List<Map<String, Object>>) body.get("steps");
        List<Map<String, Double>> path = (List<Map<String, Double>>) body.get("path");
        if (stepsData == null || path == null) throw new RuntimeException("Invalid ACO response");

        List<RouteOptimizationResponse.RouteStepData> steps = stepsData.stream()
                .map(s -> RouteOptimizationResponse.RouteStepData.builder()
                        .order(((Number) s.get("order")).intValue())
                        .attractionId(((Number) s.get("attractionId")).longValue())
                        .attractionName((String) s.get("attractionName"))
                        .latitude(((Number) s.get("latitude")).doubleValue())
                        .longitude(((Number) s.get("longitude")).doubleValue())
                        .distanceToNext(s.get("distanceToNext") != null ? ((Number) s.get("distanceToNext")).doubleValue() : null)
                        .estimatedVisitTime(s.get("estimatedVisitTime") != null ? ((Number) s.get("estimatedVisitTime")).intValue() : null)
                        .build())
                .toList();

        List<Map<String, Double>> routeGeometry = (List<Map<String, Double>>) body.get("routeGeometry");
        List<List<Map<String, Double>>> routeSegments = (List<List<Map<String, Double>>>) body.get("routeSegments");
        Boolean usedOsrm = (Boolean) body.get("usedOsrm");

        return RouteOptimizationResponse.builder()
                .steps(steps)
                .totalDistance(((Number) body.get("totalDistance")).doubleValue())
                .totalTime(((Number) body.get("totalTime")).intValue())
                .path(path)
                .routeGeometry(routeGeometry != null ? routeGeometry : path)
                .routeSegments(routeSegments != null ? routeSegments : List.of())
                .usedOsrm(usedOsrm != null && usedOsrm)
                .build();
    }

    private void enrichWithNames(RouteOptimizationResponse response, List<TouristAttraction> attractions) {
        Map<Long, String> nameMap = attractions.stream()
                .collect(Collectors.toMap(TouristAttraction::getId, TouristAttraction::getName));

        for (RouteOptimizationResponse.RouteStepData step : response.getSteps()) {
            if (step.getAttractionId() == 0L) {
                step.setAttractionName("Your Location");
            } else {
                step.setAttractionName(nameMap.getOrDefault(step.getAttractionId(), "Unknown"));
            }
        }
    }
}
