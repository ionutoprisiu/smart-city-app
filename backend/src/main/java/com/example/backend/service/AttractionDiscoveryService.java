package com.example.backend.service;

import com.example.backend.entity.AttractionCategory;
import com.example.backend.entity.TouristAttraction;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Locale;

@Service
@Slf4j
public class AttractionDiscoveryService {

    private static final String OVERPASS_URL = "https://overpass-api.de/api/interpreter";
    private static final String CITY = "Cluj-Napoca";

    private final RestTemplate restTemplate;

    public AttractionDiscoveryService() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(4000);
        factory.setReadTimeout(12000);
        this.restTemplate = new RestTemplate(factory);
    }

    public List<TouristAttraction> discoverAttractions(double lat, double lon, double radiusKm) {
        try {
            log.info("Discovering attractions in {} (city-wide)", CITY);

            List<TouristAttraction> cityWide = parseResponse(executeQuery(buildCityAreaQuery()));
            if (!cityWide.isEmpty()) {
                List<TouristAttraction> deduped = dedupeAttractions(cityWide);
                log.info("Discovered {} city-wide attractions", deduped.size());
                return deduped;
            }

            // Fallback to around query if area query fails or returns empty.
            double radiusMeters = radiusKm * 1000.0;
            List<TouristAttraction> around = parseResponse(executeQuery(buildAroundQuery(lat, lon, radiusMeters)));
            List<TouristAttraction> deduped = dedupeAttractions(around);
            log.info("Discovered {} attractions via fallback around query", deduped.size());
            return deduped;
        } catch (Exception e) {
            log.error("Error discovering attractions: {}", e.getMessage());
            return new ArrayList<>();
        }
    }

    private String buildAroundQuery(double lat, double lon, double radius) {
        String around = String.format("around:%f,%f,%f", radius, lat, lon);
        return String.format(
            "[out:json][timeout:25];(" +
            "node[\"tourism\"][\"name\"](%s);" +
            "way[\"tourism\"][\"name\"](%s);" +
            "node[\"amenity\"=\"restaurant\"][\"name\"](%s);" +
            "node[\"amenity\"=\"cafe\"][\"name\"](%s);" +
            "node[\"amenity\"=\"museum\"][\"name\"](%s);" +
            "node[\"amenity\"=\"theatre\"][\"name\"](%s);" +
            "node[\"historic\"][\"name\"](%s);" +
            "way[\"historic\"][\"name\"](%s);" +
            "node[\"leisure\"=\"park\"][\"name\"](%s);" +
            "way[\"leisure\"=\"park\"][\"name\"](%s);" +
            "node[\"amenity\"=\"place_of_worship\"][\"name\"](%s);" +
            "way[\"amenity\"=\"place_of_worship\"][\"name\"](%s);" +
            ");out center meta;",
            around, around, around, around, around, around,
            around, around, around, around, around, around
        );
    }

    private String buildCityAreaQuery() {
        return """
            [out:json][timeout:60];
            area["name"="Cluj-Napoca"]["boundary"="administrative"]->.searchArea;
            (
              nwr["tourism"~"attraction|museum|gallery|viewpoint|zoo|theme_park|aquarium|artwork"]["name"](area.searchArea);
              nwr["historic"]["name"](area.searchArea);
              nwr["amenity"~"museum|theatre|arts_centre|cinema|place_of_worship|library|university|restaurant|cafe|pub|bar"]["name"](area.searchArea);
              nwr["leisure"~"park|garden|nature_reserve"]["name"](area.searchArea);
              nwr["building"~"church|cathedral|synagogue|chapel"]["name"](area.searchArea);
              nwr["memorial"]["name"](area.searchArea);
            );
            out center tags;
            """;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> executeQuery(String query) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("User-Agent", "SmartCityApp/1.0");
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

        Map<String, Object> response = restTemplate.exchange(
            OVERPASS_URL, HttpMethod.POST,
            new HttpEntity<>(query, headers), Map.class
        ).getBody();

        return response != null ? response : Map.of();
    }

    @SuppressWarnings("unchecked")
    private List<TouristAttraction> parseResponse(Map<String, Object> response) {
        List<TouristAttraction> attractions = new ArrayList<>();
        List<Map<String, Object>> elements = (List<Map<String, Object>>) response.get("elements");
        if (elements == null) return attractions;

        for (Map<String, Object> element : elements) {
            try {
                TouristAttraction attraction = parseElement(element);
                if (attraction != null) attractions.add(attraction);
            } catch (Exception e) {
                log.warn("Skipping element: {}", e.getMessage());
            }
        }
        return attractions;
    }

    private List<TouristAttraction> dedupeAttractions(List<TouristAttraction> attractions) {
        Map<String, TouristAttraction> unique = new LinkedHashMap<>();
        for (TouristAttraction a : attractions) {
            String key = dedupeKey(a);
            unique.putIfAbsent(key, a);
        }
        return new ArrayList<>(unique.values());
    }

    private String dedupeKey(TouristAttraction a) {
        String name = a.getName() != null ? a.getName().trim().toLowerCase(Locale.ROOT) : "";
        long lat = Math.round(a.getLatitude() * 10000);
        long lon = Math.round(a.getLongitude() * 10000);
        return name + "|" + lat + "|" + lon;
    }

    @SuppressWarnings("unchecked")
    private TouristAttraction parseElement(Map<String, Object> element) {
        Map<String, Object> tags = (Map<String, Object>) element.get("tags");
        if (tags == null) return null;

        String name = (String) tags.get("name");
        if (name == null || name.isEmpty()) return null;

        Double lat = null, lon = null;
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
        if (lat == null || lon == null) return null;

        AttractionCategory category = determineCategory(tags);
        String description = (String) tags.getOrDefault("description",
            tags.getOrDefault("tourism", tags.getOrDefault("amenity", "")));

        return TouristAttraction.builder()
                .name(name)
                .description(description != null ? description : "")
                .latitude(lat).longitude(lon)
                .city(CITY)
                .category(category)
                .estimatedVisitTime(estimateVisitTime(category))
                .isActive(true)
                .build();
    }

    private AttractionCategory determineCategory(Map<String, Object> tags) {
        String tourism = (String) tags.get("tourism");
        if (tourism != null) {
            return switch (tourism.toLowerCase()) {
                case "museum" -> AttractionCategory.MUSEUM;
                case "attraction" -> AttractionCategory.MONUMENT;
                case "gallery" -> AttractionCategory.MUSEUM;
                case "viewpoint" -> AttractionCategory.MONUMENT;
                case "hotel" -> AttractionCategory.HOTEL;
                case "artwork" -> AttractionCategory.MONUMENT;
                default -> AttractionCategory.OTHER;
            };
        }

        String amenity = (String) tags.get("amenity");
        if (amenity != null) {
            return switch (amenity.toLowerCase()) {
                case "cafe" -> AttractionCategory.CAFE;
                case "museum" -> AttractionCategory.MUSEUM;
                case "theatre" -> AttractionCategory.THEATER;
                case "place_of_worship" -> AttractionCategory.CHURCH;
                case "library" -> AttractionCategory.LIBRARY;
                case "restaurant", "pub", "bar" -> AttractionCategory.RESTAURANT;
                default -> AttractionCategory.OTHER;
            };
        }

        if (tags.containsKey("historic")) return AttractionCategory.MONUMENT;
        if ("park".equals(tags.get("leisure"))) return AttractionCategory.PARK;
        return AttractionCategory.OTHER;
    }

    private int estimateVisitTime(AttractionCategory category) {
        return switch (category) {
            case MUSEUM -> 90;
            case RESTAURANT -> 60;
            case PARK -> 45;
            case CAFE, CHURCH, MONUMENT -> 30;
            case THEATER -> 120;
            default -> 30;
        };
    }
}
