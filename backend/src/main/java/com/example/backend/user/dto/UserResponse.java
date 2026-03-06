package com.example.backend.user.dto;

import com.example.backend.user.entity.Role;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserResponse {
    private Long userId;
    private String email;
    private String firstName;
    private String lastName;
    private String phoneNumber;
    private String licensePlate;
    private Role role;
    private Boolean isVerified;
    private Boolean isApproved;
    private String idCardImageUrl;
    private LocalDateTime createdAt;
    private LocalDateTime approvedAt;
}
