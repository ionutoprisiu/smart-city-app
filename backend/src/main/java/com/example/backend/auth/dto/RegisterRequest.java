package com.example.backend.auth.dto;

import com.example.backend.user.entity.Role;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class RegisterRequest {
    
    @NotBlank(message = "Email is required")
    @Email(message = "Email must be valid")
    private String email;
    
    @NotBlank(message = "Password is required")
    @Size(min = 1)
    private String password;
    
    @NotBlank(message = "First name is required")
    private String firstName;
    
    @NotBlank(message = "Last name is required")
    private String lastName;
    
    private String phoneNumber;

    private String address; // Required for LOCUITOR

    @NotNull(message = "Role is required")
    private Role role;

    private String idCardImageUrl; // ID card photo (for residents)
    
    private String operatorPassword; // Operator password (optional)
}
