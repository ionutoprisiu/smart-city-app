package com.example.backend.config;

import com.example.backend.visit_city.entity.AttractionCategory;
import com.example.backend.visit_city.entity.TouristAttraction;
import com.example.backend.visit_city.repository.TouristAttractionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@RequiredArgsConstructor
public class TouristAttractionInitializer implements CommandLineRunner {

    private final TouristAttractionRepository attractionRepository;

    @Override
    public void run(String... args) {
        if (attractionRepository.count() > 0) {
            return;
        }

        List<TouristAttraction> attractions = List.of(
                // Squares & Monuments
                TouristAttraction.builder()
                        .name("Piata Mare")
                        .description("The main square of Sibiu, surrounded by historic buildings")
                        .latitude(46.1914)
                        .longitude(24.1406)
                        .city("Sibiu")
                        .category(AttractionCategory.SQUARE)
                        .estimatedVisitTime(30)
                        .isActive(true)
                        .build(),

                TouristAttraction.builder()
                        .name("Council Tower")
                        .description("The iconic tower of Sibiu, a symbol of the city")
                        .latitude(46.1917)
                        .longitude(24.1408)
                        .city("Sibiu")
                        .category(AttractionCategory.MONUMENT)
                        .estimatedVisitTime(45)
                        .isActive(true)
                        .build(),

                TouristAttraction.builder()
                        .name("Bridge of Lies")
                        .description("The legendary bridge of Sibiu, steeped in legends and history")
                        .latitude(46.1915)
                        .longitude(24.1415)
                        .city("Sibiu")
                        .category(AttractionCategory.MONUMENT)
                        .estimatedVisitTime(15)
                        .isActive(true)
                        .build(),

                // Museums
                TouristAttraction.builder()
                        .name("Brukenthal Museum")
                        .description("Art and history museum, one of the most important collections in Romania")
                        .latitude(46.1910)
                        .longitude(24.1400)
                        .city("Sibiu")
                        .category(AttractionCategory.MUSEUM)
                        .estimatedVisitTime(90)
                        .isActive(true)
                        .build(),

                TouristAttraction.builder()
                        .name("ASTRA Museum")
                        .description("ASTRA National Museum Complex of Traditional Folk Civilization")
                        .latitude(46.1800)
                        .longitude(24.1200)
                        .city("Sibiu")
                        .category(AttractionCategory.MUSEUM)
                        .estimatedVisitTime(120)
                        .isActive(true)
                        .build(),

                // Churches
                TouristAttraction.builder()
                        .name("Evangelical Church")
                        .description("The evangelical church in the historic center")
                        .latitude(46.1920)
                        .longitude(24.1410)
                        .city("Sibiu")
                        .category(AttractionCategory.CHURCH)
                        .estimatedVisitTime(30)
                        .isActive(true)
                        .build(),

                TouristAttraction.builder()
                        .name("Orthodox Cathedral")
                        .description("The orthodox cathedral of Sibiu")
                        .latitude(46.1930)
                        .longitude(24.1420)
                        .city("Sibiu")
                        .category(AttractionCategory.CHURCH)
                        .estimatedVisitTime(30)
                        .isActive(true)
                        .build(),

                // Parks
                TouristAttraction.builder()
                        .name("Sub Arini Park")
                        .description("The main park of Sibiu, perfect for relaxation")
                        .latitude(46.1950)
                        .longitude(24.1450)
                        .city("Sibiu")
                        .category(AttractionCategory.PARK)
                        .estimatedVisitTime(45)
                        .isActive(true)
                        .build(),

                // Restaurants & Cafes
                TouristAttraction.builder()
                        .name("Crama Sibiana")
                        .description("Traditional Romanian restaurant")
                        .latitude(46.1918)
                        .longitude(24.1407)
                        .city("Sibiu")
                        .category(AttractionCategory.RESTAURANT)
                        .estimatedVisitTime(60)
                        .isActive(true)
                        .build(),

                TouristAttraction.builder()
                        .name("Cafeneaua Imperium")
                        .description("Cafe in the historic center")
                        .latitude(46.1916)
                        .longitude(24.1409)
                        .city("Sibiu")
                        .category(AttractionCategory.CAFE)
                        .estimatedVisitTime(30)
                        .isActive(true)
                        .build(),

                TouristAttraction.builder()
                        .name("Cafeneaua Hermania")
                        .description("Cafe with authentic atmosphere")
                        .latitude(46.1912)
                        .longitude(24.1405)
                        .city("Sibiu")
                        .category(AttractionCategory.CAFE)
                        .estimatedVisitTime(30)
                        .isActive(true)
                        .build(),

                // Other
                TouristAttraction.builder()
                        .name("Sibiu Fortress")
                        .description("The medieval fortifications of Sibiu")
                        .latitude(46.1925)
                        .longitude(24.1420)
                        .city("Sibiu")
                        .category(AttractionCategory.FORTRESS)
                        .estimatedVisitTime(60)
                        .isActive(true)
                        .build(),

                TouristAttraction.builder()
                        .name("National Theatre")
                        .description("Radu Stanca National Theatre")
                        .latitude(46.1900)
                        .longitude(24.1390)
                        .city("Sibiu")
                        .category(AttractionCategory.THEATER)
                        .estimatedVisitTime(30)
                        .isActive(true)
                        .build()
        );

        attractionRepository.saveAll(attractions);
        System.out.println("Initialized " + attractions.size() + " tourist attractions in Sibiu");
    }
}
