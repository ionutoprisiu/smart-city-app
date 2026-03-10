package com.example.backend.controller;

import com.example.backend.dto.RouteOptimizationResponse;
import com.example.backend.dto.TouristAttractionResponse;
import com.example.backend.service.VisitCityService;
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
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String q) {
        List<TouristAttractionResponse> attractions = visitCityService.getAttractions(category, q);
        return ResponseEntity.ok(Map.of("data", attractions));
    }

    @GetMapping("/attractions/live")
    public ResponseEntity<?> getLiveAttractions(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Integer limit) {
        List<TouristAttractionResponse> attractions = visitCityService.getLiveAttractions(q, limit);
        return ResponseEntity.ok(Map.of("data", attractions));
    }

    @PostMapping("/optimize")
    public ResponseEntity<?> optimizeRoute(@RequestBody Map<String, Object> request) {
        List<Long> attractionIds = extractAttractionIds(request);
        Double startLat = extractDouble(request, "startLatitude");
        Double startLon = extractDouble(request, "startLongitude");
        RouteOptimizationResponse response = visitCityService.optimizeRoute(attractionIds, startLat, startLon);
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
