package com.example.backend.user.service;

import com.example.backend.user.dto.UserResponse;
import com.example.backend.user.entity.Role;
import com.example.backend.user.entity.User;
import com.example.backend.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;

    private void ensureStaff(Long userId) {
        User u = userRepository.findById(userId).orElseThrow(() -> new RuntimeException("User not found"));
        if (u.getRole() != Role.ADMIN && u.getRole() != Role.OPERATOR) {
            throw new RuntimeException("Forbidden");
        }
    }

    private List<User> filterByRole(Long staffId, List<User> users) {
        User staff = userRepository.findById(staffId).orElseThrow(() -> new RuntimeException("User not found"));
        if (staff.getRole() == Role.ADMIN) return users;
        return users.stream().filter(u -> u.getRole() == Role.LOCUITOR).collect(Collectors.toList());
    }

    public List<UserResponse> getPendingResidents(Long staffId) {
        ensureStaff(staffId);
        List<User> pending = userRepository.findAll().stream()
                .filter(u -> u.getRole() == Role.LOCUITOR && !Boolean.TRUE.equals(u.getIsApproved()))
                .collect(Collectors.toList());
        return filterByRole(staffId, pending).stream().map(this::toResponse).collect(Collectors.toList());
    }

    public List<UserResponse> getAllUsers(Long staffId) {
        ensureStaff(staffId);
        return filterByRole(staffId, userRepository.findAll()).stream().map(this::toResponse).collect(Collectors.toList());
    }

    public UserResponse getUserById(Long userId, Long staffId) {
        ensureStaff(staffId);
        User user = userRepository.findById(userId).orElseThrow(() -> new RuntimeException("User not found"));
        User staff = userRepository.findById(staffId).orElseThrow(() -> new RuntimeException("User not found"));
        if (staff.getRole() == Role.OPERATOR && user.getRole() != Role.LOCUITOR) {
            throw new RuntimeException("Forbidden");
        }
        return toResponse(user);
    }

    @Transactional
    public UserResponse approveUser(Long userId, Long staffId, boolean approve, String rejectionReason) {
        ensureStaff(staffId);
        User user = userRepository.findById(userId).orElseThrow(() -> new RuntimeException("User not found"));
        if (user.getRole() != Role.LOCUITOR) throw new RuntimeException("Only residents can be approved");
        if (approve) {
            user.setIsApproved(true);
            user.setIsVerified(true);
            user.setApprovedAt(LocalDateTime.now());
        } else {
            user.setIdCardImageUrl(null);
            user.setIsApproved(false);
            user.setIsVerified(false);
        }
        user = userRepository.save(user);
        return toResponse(user);
    }

    private UserResponse toResponse(User user) {
        return UserResponse.builder()
                .userId(user.getId())
                .email(user.getEmail())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .phoneNumber(user.getPhoneNumber())
                .licensePlate(user.getLicensePlate())
                .role(user.getRole())
                .isVerified(user.getIsVerified())
                .isApproved(user.getIsApproved())
                .idCardImageUrl(user.getIdCardImageUrl())
                .createdAt(user.getCreatedAt())
                .approvedAt(user.getApprovedAt())
                .build();
    }
}
