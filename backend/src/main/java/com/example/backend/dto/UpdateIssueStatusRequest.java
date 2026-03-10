package com.example.backend.dto;

import com.example.backend.entity.IssueStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UpdateIssueStatusRequest {
    private IssueStatus status;
    private String operatorNotes;
}
