package com.example.backend.events.controller;

import com.example.backend.events.dto.CreateEventRequest;
import com.example.backend.events.dto.EventResponse;
import com.example.backend.events.dto.UpdateEventRequest;
import com.example.backend.events.entity.EventCategory;
import com.example.backend.events.service.EventService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/events")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class EventController {

    private final EventService eventService;

    @PostMapping
    public ResponseEntity<?> createEvent(
            @RequestBody CreateEventRequest request,
            @RequestHeader("X-User-Id") Long userId) {
        EventResponse event = eventService.createEvent(request, userId);
        return ResponseEntity.ok(Map.of("data", event));
    }

    @GetMapping
    public ResponseEntity<?> getAllEvents() {
        List<EventResponse> events = eventService.getAllEvents();
        return ResponseEntity.ok(Map.of("data", events));
    }

    @GetMapping("/upcoming")
    public ResponseEntity<?> getUpcomingEvents() {
        return ResponseEntity.ok(Map.of("data", eventService.getUpcomingEvents()));
    }

    @GetMapping("/category/{category}")
    public ResponseEntity<?> getEventsByCategory(@PathVariable String category) {
        EventCategory eventCategory = EventCategory.valueOf(category.toUpperCase());
        return ResponseEntity.ok(Map.of("data", eventService.getEventsByCategory(eventCategory)));
    }

    @GetMapping("/search")
    public ResponseEntity<?> searchEvents(@RequestParam String q) {
        return ResponseEntity.ok(Map.of("data", eventService.searchEvents(q)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getEventById(@PathVariable Long id) {
        return ResponseEntity.ok(Map.of("data", eventService.getEventById(id)));
    }

    @GetMapping("/my-events")
    public ResponseEntity<?> getMyEvents(@RequestHeader("X-User-Id") Long userId) {
        return ResponseEntity.ok(Map.of("data", eventService.getEventsByOrganizer(userId)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateEvent(
            @PathVariable Long id,
            @RequestBody UpdateEventRequest request,
            @RequestHeader("X-User-Id") Long userId) {
        return ResponseEntity.ok(Map.of("data", eventService.updateEvent(id, request, userId)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteEvent(@PathVariable Long id, @RequestHeader("X-User-Id") Long userId) {
        eventService.deleteEvent(id, userId);
        return ResponseEntity.ok(Map.of("message", "Event deleted successfully"));
    }
}
