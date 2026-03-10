package com.example.backend.controller;

import com.example.backend.dto.CreateIssueRequest;
import com.example.backend.dto.IssueResponse;
import com.example.backend.dto.UpdateIssueStatusRequest;
import com.example.backend.entity.IssueStatus;
import com.example.backend.service.IssueService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/issues")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class IssueController {

    private final IssueService issueService;

    @PostMapping
    public ResponseEntity<IssueResponse> createIssue(
            @Valid @RequestBody CreateIssueRequest request,
            @RequestHeader("X-User-Id") Long userId) {
        return ResponseEntity.status(HttpStatus.CREATED).body(issueService.createIssue(request, userId));
    }

    @GetMapping
    public ResponseEntity<List<IssueResponse>> getAllIssues(@RequestHeader("X-User-Id") Long userId) {
        return ResponseEntity.ok(issueService.getAllIssues(userId));
    }

    @GetMapping("/status/{status}")
    public ResponseEntity<List<IssueResponse>> getIssuesByStatus(
            @PathVariable IssueStatus status,
            @RequestHeader("X-User-Id") Long userId) {
        return ResponseEntity.ok(issueService.getIssuesByStatus(status, userId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<IssueResponse> getIssueById(
            @PathVariable Long id,
            @RequestHeader("X-User-Id") Long userId) {
        return ResponseEntity.ok(issueService.getIssueById(id, userId));
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<IssueResponse> updateIssueStatus(
            @PathVariable Long id,
            @Valid @RequestBody UpdateIssueStatusRequest request,
            @RequestHeader("X-User-Id") Long userId) {
        return ResponseEntity.ok(issueService.updateIssueStatus(id, request, userId));
    }
}
