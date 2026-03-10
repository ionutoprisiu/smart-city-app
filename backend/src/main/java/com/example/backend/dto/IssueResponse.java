package com.example.backend.dto;

import com.example.backend.entity.IssueStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class IssueResponse {
    private Long id;
    private String description;
    private String imageUrl;
    private Double latitude;
    private Double longitude;
    private String address;
    private IssueStatus status;
    private Long createdById;
    private String createdByFirstName;
    private String createdByLastName;
    private String createdByEmail;
    private Long assignedOperatorId;
    private String assignedOperatorFirstName;
    private String assignedOperatorLastName;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime resolvedAt;
    private String operatorNotes;
}
