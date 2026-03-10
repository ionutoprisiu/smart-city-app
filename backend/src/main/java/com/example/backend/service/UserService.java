package com.example.backend.service;

import com.example.backend.dto.UserResponse;
import com.example.backend.entity.Role;
import com.example.backend.entity.User;
import com.example.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;

    public List<UserResponse> getAllUsers(Long adminId) {
        ensureAdmin(adminId);
        return userRepository.findAll().stream().map(this::toResponse).toList();
    }

    public UserResponse getUserById(Long userId, Long adminId) {
        ensureAdmin(adminId);
        return toResponse(findUser(userId));
    }

    public UserResponse getProfile(Long userId) {
        return toResponse(findUser(userId));
    }

    private void ensureAdmin(Long userId) {
        User user = findUser(userId);
        if (user.getRole() != Role.ADMIN) {
            throw new RuntimeException("Forbidden");
        }
    }

    private User findUser(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    private UserResponse toResponse(User user) {
        return UserResponse.builder()
                .userId(user.getId())
                .email(user.getEmail())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .phoneNumber(user.getPhoneNumber())
                .role(user.getRole())
                .isVerified(user.getIsVerified())
                .createdAt(user.getCreatedAt())
                .build();
    }
}
