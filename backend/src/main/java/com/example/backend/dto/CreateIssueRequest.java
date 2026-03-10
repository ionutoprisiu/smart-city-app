package com.example.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CreateIssueRequest {
    private String description;
    private String imageUrl;
    private Double latitude;
    private Double longitude;
    private String address;
}
