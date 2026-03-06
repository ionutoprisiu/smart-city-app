package com.example.backend.auth.dto;

import com.example.backend.user.entity.Role;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuthResponse {
    private Long userId;
    private String email;
    private Role role;
    private String firstName;
    private String lastName;
    private Boolean isVerified;
    private Boolean isApproved;
    private String message;
}
