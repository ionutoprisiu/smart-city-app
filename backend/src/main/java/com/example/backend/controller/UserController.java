package com.example.backend.controller;

import com.example.backend.dto.UserResponse;
import com.example.backend.service.UserService;
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

    @GetMapping("/profile")
    public ResponseEntity<UserResponse> getProfile(@RequestHeader("X-User-Id") Long currentUserId) {
        return ResponseEntity.ok(userService.getProfile(currentUserId));
    }
}
