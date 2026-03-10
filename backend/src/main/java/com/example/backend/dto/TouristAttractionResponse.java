package com.example.backend.dto;

import com.example.backend.entity.AttractionCategory;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TouristAttractionResponse {
    private Long id;
    private String name;
    private String description;
    private Double latitude;
    private Double longitude;
    private String city;
    private AttractionCategory category;
    private String imageUrl;
    private Integer estimatedVisitTime;
    private Boolean isActive;
}
