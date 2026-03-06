package com.example.backend.visit_city.controller;

import com.example.backend.visit_city.dto.RouteOptimizationResponse;
import com.example.backend.visit_city.dto.TouristAttractionResponse;
import com.example.backend.visit_city.service.VisitCityService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/visit-city")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class VisitCityController {

    private final VisitCityService visitCityService;

    @GetMapping("/attractions")
    public ResponseEntity<?> getAttractions(
            @RequestParam(required = false) Double latitude,
            @RequestParam(required = false) Double longitude,
            @RequestParam(required = false) String city,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String q) {
        List<TouristAttractionResponse> attractions = visitCityService.getAttractions(
                latitude, longitude, city, category, q);
        return ResponseEntity.ok(Map.of("data", attractions));
    }

    @PostMapping("/optimize")
    public ResponseEntity<?> optimizeRoute(@RequestBody Map<String, Object> request) {
        List<Long> attractionIds = extractAttractionIds(request);
        Double startLatitude = extractDouble(request, "startLatitude");
        Double startLongitude = extractDouble(request, "startLongitude");
        RouteOptimizationResponse response = visitCityService.optimizeRoute(
                attractionIds, startLatitude, startLongitude);
        return ResponseEntity.ok(Map.of("data", response));
    }

    @SuppressWarnings("unchecked")
    private List<Long> extractAttractionIds(Map<String, Object> request) {
        Object idsObj = request.get("attractionIds");
        if (idsObj == null || !(idsObj instanceof List)) throw new IllegalArgumentException("attractionIds required");
        List<Number> ids = (List<Number>) idsObj;
        if (ids.isEmpty()) throw new IllegalArgumentException("attractionIds cannot be empty");
        return ids.stream().map(Number::longValue).toList();
    }

    private Double extractDouble(Map<String, Object> request, String key) {
        Object value = request.get(key);
        if (value == null) return null;
        if (value instanceof Number) return ((Number) value).doubleValue();
        throw new IllegalArgumentException(key + " must be a number");
    }
}
