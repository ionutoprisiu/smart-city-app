package com.example.backend.service;

import com.example.backend.dto.CreateIssueRequest;
import com.example.backend.dto.IssueResponse;
import com.example.backend.dto.UpdateIssueStatusRequest;
import com.example.backend.entity.Issue;
import com.example.backend.entity.IssueStatus;
import com.example.backend.entity.Role;
import com.example.backend.entity.User;
import com.example.backend.repository.IssueRepository;
import com.example.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class IssueService {

    private final IssueRepository issueRepository;
    private final UserRepository userRepository;

    @Transactional
    public IssueResponse createIssue(CreateIssueRequest request, Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        Issue issue = Issue.builder()
                .description(request.getDescription())
                .imageUrl(request.getImageUrl())
                .latitude(request.getLatitude())
                .longitude(request.getLongitude())
                .address(request.getAddress())
                .status(IssueStatus.DESCHISA)
                .createdBy(user)
                .build();

        return mapToResponse(issueRepository.save(issue));
    }

    public List<IssueResponse> getAllIssues(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        List<Issue> issues = user.getRole() == Role.ADMIN
                ? issueRepository.findAllOrderByCreatedAtDesc()
                : issueRepository.findByCreatedByOrderByCreatedAtDesc(user);

        return issues.stream().map(this::mapToResponse).toList();
    }

    public List<IssueResponse> getIssuesByStatus(IssueStatus status, Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        List<Issue> issues = user.getRole() == Role.ADMIN
                ? issueRepository.findByStatusOrderByCreatedAtDesc(status)
                : issueRepository.findByCreatedByAndStatusOrderByCreatedAtDesc(user, status);

        return issues.stream().map(this::mapToResponse).toList();
    }

    public IssueResponse getIssueById(Long issueId, Long userId) {
        Issue issue = issueRepository.findById(issueId)
                .orElseThrow(() -> new RuntimeException("Issue not found"));
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (user.getRole() != Role.ADMIN && !issue.getCreatedBy().getId().equals(userId)) {
            throw new RuntimeException("You don't have permission to view this issue");
        }
        return mapToResponse(issue);
    }

    @Transactional
    public IssueResponse updateIssueStatus(Long issueId, UpdateIssueStatusRequest request, Long userId) {
        Issue issue = issueRepository.findById(issueId)
                .orElseThrow(() -> new RuntimeException("Issue not found"));
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (user.getRole() != Role.ADMIN) {
            throw new RuntimeException("Only admins can update issue status");
        }

        issue.setStatus(request.getStatus());

        if (issue.getAssignedOperator() == null) {
            issue.setAssignedOperator(user);
        }
        if (request.getOperatorNotes() != null && !request.getOperatorNotes().isEmpty()) {
            issue.setOperatorNotes(request.getOperatorNotes());
        }
        if (request.getStatus() == IssueStatus.REZOLVATA && issue.getResolvedAt() == null) {
            issue.setResolvedAt(LocalDateTime.now());
        }

        return mapToResponse(issueRepository.save(issue));
    }

    private IssueResponse mapToResponse(Issue issue) {
        IssueResponse.IssueResponseBuilder builder = IssueResponse.builder()
                .id(issue.getId())
                .description(issue.getDescription())
                .imageUrl(issue.getImageUrl())
                .latitude(issue.getLatitude())
                .longitude(issue.getLongitude())
                .address(issue.getAddress())
                .status(issue.getStatus())
                .createdById(issue.getCreatedBy().getId())
                .createdByFirstName(issue.getCreatedBy().getFirstName())
                .createdByLastName(issue.getCreatedBy().getLastName())
                .createdByEmail(issue.getCreatedBy().getEmail())
                .createdAt(issue.getCreatedAt())
                .updatedAt(issue.getUpdatedAt())
                .resolvedAt(issue.getResolvedAt())
                .operatorNotes(issue.getOperatorNotes());

        if (issue.getAssignedOperator() != null) {
            builder.assignedOperatorId(issue.getAssignedOperator().getId())
                    .assignedOperatorFirstName(issue.getAssignedOperator().getFirstName())
                    .assignedOperatorLastName(issue.getAssignedOperator().getLastName());
        }

        return builder.build();
    }
}
