package com.example.backend.events.service;

import com.example.backend.events.dto.CreateEventRequest;
import com.example.backend.events.dto.EventResponse;
import com.example.backend.events.dto.UpdateEventRequest;
import com.example.backend.events.entity.Event;
import com.example.backend.events.entity.EventCategory;
import com.example.backend.events.repository.EventRepository;
import com.example.backend.user.entity.Role;
import com.example.backend.user.entity.User;
import com.example.backend.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class EventService {
    
    private final EventRepository eventRepository;
    private final UserRepository userRepository;
    
    @Transactional
    public EventResponse createEvent(CreateEventRequest request, Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        // Only organizers can create events
        if (user.getRole() != Role.ORGANIZATOR) {
            throw new RuntimeException("Only organizers can create events");
        }
        
        Event event = Event.builder()
                .title(request.getTitle())
                .description(request.getDescription())
                .startDateTime(request.getStartDateTime())
                .endDateTime(request.getEndDateTime())
                .location(request.getLocation())
                .latitude(request.getLatitude())
                .longitude(request.getLongitude())
                .imageUrl(request.getImageUrl())
                .category(request.getCategory())
                .createdBy(user)
                .isActive(true)
                .build();
        
        event = eventRepository.save(event);
        return mapToResponse(event);
    }
    
    public List<EventResponse> getAllEvents() {
        List<Event> events = eventRepository.findAllActiveOrderByStartDateTime();
        return events.stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }
    
    public List<EventResponse> getUpcomingEvents() {
        List<Event> events = eventRepository.findUpcomingEvents(LocalDateTime.now());
        return events.stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }
    
    public List<EventResponse> getEventsByCategory(EventCategory category) {
        List<Event> events = eventRepository.findByCategoryAndIsActiveTrueOrderByStartDateTimeAsc(category);
        return events.stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }
    
    public List<EventResponse> searchEvents(String query) {
        List<Event> events = eventRepository.searchEvents(query);
        return events.stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }
    
    public EventResponse getEventById(Long eventId) {
        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> new RuntimeException("Event not found"));
        return mapToResponse(event);
    }
    
    public List<EventResponse> getEventsByOrganizer(Long organizerId) {
        User organizer = userRepository.findById(organizerId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        List<Event> events = eventRepository.findByCreatedByOrderByCreatedAtDesc(organizer);
        return events.stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }
    
    @Transactional
    public EventResponse updateEvent(Long eventId, UpdateEventRequest request, Long userId) {
        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> new RuntimeException("Event not found"));
        
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        // Only the organizer who created the event or admins can edit
        if (!event.getCreatedBy().getId().equals(userId) && user.getRole() != Role.ADMIN) {
            throw new RuntimeException("You don't have permission to update this event");
        }
        
        if (request.getTitle() != null) {
            event.setTitle(request.getTitle());
        }
        if (request.getDescription() != null) {
            event.setDescription(request.getDescription());
        }
        if (request.getStartDateTime() != null) {
            event.setStartDateTime(request.getStartDateTime());
        }
        if (request.getEndDateTime() != null) {
            event.setEndDateTime(request.getEndDateTime());
        }
        if (request.getLocation() != null) {
            event.setLocation(request.getLocation());
        }
        if (request.getLatitude() != null) {
            event.setLatitude(request.getLatitude());
        }
        if (request.getLongitude() != null) {
            event.setLongitude(request.getLongitude());
        }
        if (request.getImageUrl() != null) {
            event.setImageUrl(request.getImageUrl());
        }
        if (request.getCategory() != null) {
            event.setCategory(request.getCategory());
        }
        if (request.getIsActive() != null) {
            event.setIsActive(request.getIsActive());
        }
        
        event = eventRepository.save(event);
        return mapToResponse(event);
    }
    
    @Transactional
    public void deleteEvent(Long eventId, Long userId) {
        Event event = eventRepository.findById(eventId)
                .orElseThrow(() -> new RuntimeException("Event not found"));
        
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        // Only the organizer who created the event or admins can delete
        if (!event.getCreatedBy().getId().equals(userId) && user.getRole() != Role.ADMIN) {
            throw new RuntimeException("You don't have permission to delete this event");
        }
        
        eventRepository.delete(event);
    }
    
    private EventResponse mapToResponse(Event event) {
        return EventResponse.builder()
                .id(event.getId())
                .title(event.getTitle())
                .description(event.getDescription())
                .startDateTime(event.getStartDateTime())
                .endDateTime(event.getEndDateTime())
                .location(event.getLocation())
                .latitude(event.getLatitude())
                .longitude(event.getLongitude())
                .imageUrl(event.getImageUrl())
                .category(event.getCategory())
                .createdById(event.getCreatedBy().getId())
                .createdByFirstName(event.getCreatedBy().getFirstName())
                .createdByLastName(event.getCreatedBy().getLastName())
                .createdAt(event.getCreatedAt())
                .updatedAt(event.getUpdatedAt())
                .isActive(event.getIsActive())
                .build();
    }
}
