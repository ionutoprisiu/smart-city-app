package com.example.backend.config;

import com.example.backend.entity.AttractionCategory;
import com.example.backend.entity.TouristAttraction;
import com.example.backend.repository.TouristAttractionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class TouristAttractionInitializer implements CommandLineRunner {

    private final TouristAttractionRepository attractionRepository;

    @Override
    public void run(String... args) {
        if (attractionRepository.count() > 0) return;

        List<TouristAttraction> attractions = List.of(
                attraction("Piata Unirii", "The main square of Cluj-Napoca, heart of the city", 46.7712, 23.5898, AttractionCategory.SQUARE, 30),
                attraction("St. Michael's Church", "Gothic church in the center of Piata Unirii", 46.7710, 23.5901, AttractionCategory.CHURCH, 30),
                attraction("Matthias Corvinus Statue", "Equestrian statue of King Matthias Corvinus", 46.7708, 23.5896, AttractionCategory.MONUMENT, 15),
                attraction("National Museum of Art", "Art museum in the Banffy Palace", 46.7706, 23.5892, AttractionCategory.MUSEUM, 90),
                attraction("Ethnographic Museum of Transylvania", "Museum of Transylvanian folk culture", 46.7700, 23.5880, AttractionCategory.MUSEUM, 60),
                attraction("Central Park", "Main park of Cluj-Napoca with lake and casino", 46.7680, 23.5790, AttractionCategory.PARK, 45),
                attraction("Casino Building", "Historic casino building in Central Park", 46.7678, 23.5785, AttractionCategory.MONUMENT, 20),
                attraction("Botanical Garden", "One of the largest botanical gardens in Romania", 46.7620, 23.5880, AttractionCategory.PARK, 90),
                attraction("Mirror Street", "Street known for its baroque architecture", 46.7720, 23.5910, AttractionCategory.MONUMENT, 20),
                attraction("Tailors' Bastion", "Medieval fortification tower, part of the old city walls", 46.7730, 23.5860, AttractionCategory.FORTRESS, 30),
                attraction("Orthodox Cathedral", "The Orthodox Cathedral of Cluj-Napoca", 46.7695, 23.5920, AttractionCategory.CHURCH, 30),
                attraction("National Theatre", "Lucian Blaga National Theatre", 46.7705, 23.5870, AttractionCategory.THEATER, 30),
                attraction("Cetatuia Hill", "Hill with panoramic view of the city", 46.7750, 23.5830, AttractionCategory.PARK, 60)
        );

        attractionRepository.saveAll(attractions);
        log.info("Initialized {} tourist attractions in Cluj-Napoca", attractions.size());
    }

    private TouristAttraction attraction(String name, String description, double lat, double lon,
                                          AttractionCategory category, int visitTime) {
        return TouristAttraction.builder()
                .name(name)
                .description(description)
                .latitude(lat).longitude(lon)
                .city("Cluj-Napoca")
                .category(category)
                .estimatedVisitTime(visitTime)
                .isActive(true)
                .build();
    }
}
