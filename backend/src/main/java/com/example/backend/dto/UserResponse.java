package com.example.backend.dto;

import com.example.backend.entity.Role;
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
    private Role role;
    private Boolean isVerified;
    private LocalDateTime createdAt;
}
