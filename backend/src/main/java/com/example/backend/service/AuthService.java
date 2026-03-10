package com.example.backend.service;

import com.example.backend.dto.AuthResponse;
import com.example.backend.dto.LoginRequest;
import com.example.backend.dto.RegisterRequest;
import com.example.backend.entity.Role;
import com.example.backend.entity.User;
import com.example.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            return AuthResponse.builder()
                    .message("Email already exists")
                    .build();
        }

        if (request.getPhoneNumber() != null && !request.getPhoneNumber().isEmpty()) {
            if (userRepository.existsByPhoneNumber(request.getPhoneNumber())) {
                return AuthResponse.builder()
                        .message("Phone number already exists")
                        .build();
            }
        }

        String first = request.getFirstName() != null ? request.getFirstName().trim() : "";
        String last = request.getLastName() != null ? request.getLastName().trim() : "";
        String fullName = (first + " " + last).trim();
        if (fullName.isEmpty()) fullName = " ";

        User user = User.builder()
                .email(request.getEmail())
                .password(request.getPassword())
                .firstName(request.getFirstName())
                .lastName(request.getLastName())
                .name(fullName)
                .phoneNumber(request.getPhoneNumber())
                .role(Role.USER)
                .isVerified(false)
                .build();

        user = userRepository.save(user);

        return AuthResponse.builder()
                .userId(user.getId())
                .email(user.getEmail())
                .role(user.getRole())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .isVerified(user.getIsVerified())
                .message("Registration successful")
                .build();
    }

    public AuthResponse login(LoginRequest request) {
        Optional<User> userOpt = userRepository.findByEmail(request.getEmail());

        if (userOpt.isEmpty()) {
            return AuthResponse.builder()
                    .message("Invalid email or password")
                    .build();
        }

        User user = userOpt.get();

        if (!user.getPassword().equals(request.getPassword())) {
            return AuthResponse.builder()
                    .message("Invalid email or password")
                    .build();
        }

        user.setLastLogin(LocalDateTime.now());
        userRepository.save(user);

        return AuthResponse.builder()
                .userId(user.getId())
                .email(user.getEmail())
                .role(user.getRole())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .isVerified(user.getIsVerified())
                .message("Login successful")
                .build();
    }
}
