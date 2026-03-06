package com.example.backend.issues.service;

import com.example.backend.issues.dto.CreateIssueRequest;
import com.example.backend.issues.dto.IssueResponse;
import com.example.backend.issues.dto.UpdateIssueStatusRequest;
import com.example.backend.issues.entity.Issue;
import com.example.backend.issues.entity.IssueStatus;
import com.example.backend.issues.repository.IssueRepository;
import com.example.backend.user.entity.Role;
import com.example.backend.user.entity.User;
import com.example.backend.user.repository.UserRepository;
import com.example.backend.wallet.service.WalletService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class IssueService {

    private final IssueRepository issueRepository;
    private final UserRepository userRepository;
    private final WalletService walletService;

    @Transactional
    public IssueResponse createIssue(CreateIssueRequest request, Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (user.getRole() != Role.LOCUITOR) {
            throw new RuntimeException("Only residents can create issues");
        }

        Issue issue = Issue.builder()
                .description(request.getDescription())
                .imageUrl(request.getImageUrl())
                .latitude(request.getLatitude())
                .longitude(request.getLongitude())
                .address(request.getAddress())
                .status(IssueStatus.DESCHISA)
                .createdBy(user)
                .build();

        issue = issueRepository.save(issue);
        return mapToResponse(issue);
    }

    public List<IssueResponse> getAllIssues(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        List<Issue> issues;

        if (user.getRole() == Role.OPERATOR || user.getRole() == Role.ADMIN) {
            issues = issueRepository.findAllOrderByCreatedAtDesc();
        } else {
            issues = issueRepository.findByCreatedByOrderByCreatedAtDesc(user);
        }

        return issues.stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    public List<IssueResponse> getIssuesByStatus(IssueStatus status, Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        List<Issue> issues;

        if (user.getRole() == Role.OPERATOR || user.getRole() == Role.ADMIN) {
            issues = issueRepository.findByStatusOrderByCreatedAtDesc(status);
        } else {
            issues = issueRepository.findByCreatedByAndStatusOrderByCreatedAtDesc(user, status);
        }

        return issues.stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    public IssueResponse getIssueById(Long issueId, Long userId) {
        Issue issue = issueRepository.findById(issueId)
                .orElseThrow(() -> new RuntimeException("Issue not found"));

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (user.getRole() != Role.OPERATOR &&
                user.getRole() != Role.ADMIN &&
                !issue.getCreatedBy().getId().equals(userId)) {
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

        if (user.getRole() != Role.OPERATOR && user.getRole() != Role.ADMIN) {
            throw new RuntimeException("Only operators can update issue status");
        }

        issue.setStatus(request.getStatus());

        if (issue.getAssignedOperator() == null) {
            issue.setAssignedOperator(user);
        }

        if (request.getOperatorNotes() != null && !request.getOperatorNotes().isEmpty()) {
            issue.setOperatorNotes(request.getOperatorNotes());
        }

        boolean wasResolved = issue.getStatus() == IssueStatus.REZOLVATA;
        boolean isNowResolved = request.getStatus() == IssueStatus.REZOLVATA;

        if (isNowResolved && !wasResolved) {
            issue.setResolvedAt(LocalDateTime.now());

            try {
                walletService.rewardIssueResolution(
                        issue.getCreatedBy().getId(),
                        issue.getId(),
                        issue.getDescription());
            } catch (Exception e) {
                // Log the error but don't stop processing
                System.err.println("Error rewarding issue resolution: " + e.getMessage());
            }
        }

        issue = issueRepository.save(issue);
        return mapToResponse(issue);
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
