package com.example.backend.user.controller;

import com.example.backend.user.dto.ApproveUserRequest;
import com.example.backend.user.dto.UserResponse;
import com.example.backend.user.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/users")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping("/pending")
    public ResponseEntity<List<UserResponse>> getPendingResidents(@RequestHeader("X-User-Id") Long currentUserId) {
        return ResponseEntity.ok(userService.getPendingResidents(currentUserId));
    }

    @GetMapping
    public ResponseEntity<List<UserResponse>> getAllUsers(@RequestHeader("X-User-Id") Long currentUserId) {
        return ResponseEntity.ok(userService.getAllUsers(currentUserId));
    }

    @GetMapping("/{userId}")
    public ResponseEntity<UserResponse> getUserById(
            @PathVariable Long userId,
            @RequestHeader("X-User-Id") Long currentUserId) {
        return ResponseEntity.ok(userService.getUserById(userId, currentUserId));
    }

    @PutMapping("/{userId}/approve")
    public ResponseEntity<UserResponse> approveUser(
            @PathVariable Long userId,
            @RequestBody ApproveUserRequest request,
            @RequestHeader("X-User-Id") Long currentUserId) {
        UserResponse user = userService.approveUser(
                userId, currentUserId,
                Boolean.TRUE.equals(request.getApprove()),
                request.getRejectionReason());
        return ResponseEntity.ok(user);
    }
}
