package com.example.backend.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "parking_zones")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ParkingZone {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 50)
    private String name;

    @Column(nullable = false)
    private Integer zoneNumber;

    @Column(nullable = false)
    private Double pricePerHour;

    @Column(nullable = false)
    private Double minLatitude;

    @Column(nullable = false)
    private Double maxLatitude;

    @Column(nullable = false)
    private Double minLongitude;

    @Column(nullable = false)
    private Double maxLongitude;

    @Column(nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    @Column(length = 500)
    private String description;
}
