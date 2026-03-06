package com.example.backend.auth.service;

import com.example.backend.auth.dto.AuthResponse;
import com.example.backend.auth.dto.LoginRequest;
import com.example.backend.auth.dto.RegisterRequest;
import com.example.backend.user.entity.Role;
import com.example.backend.user.entity.User;
import com.example.backend.user.repository.UserRepository;
import com.example.backend.wallet.entity.Wallet;
import com.example.backend.wallet.repository.WalletRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final WalletRepository walletRepository;

    private static final Double INITIAL_CREDITS = 1000.0;

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
                .address(request.getAddress())
                .role(request.getRole())
                .idCardImageUrl(request.getIdCardImageUrl())
                .isVerified(request.getRole() == Role.VIZITATOR || request.getRole() == Role.ORGANIZATOR)
                .isApproved(request.getRole() != Role.LOCUITOR)
                .build();

        user = userRepository.save(user);

        Wallet wallet = Wallet.builder()
                .user(user)
                .balance(INITIAL_CREDITS)
                .totalEarned(INITIAL_CREDITS)
                .totalSpent(0.0)
                .build();
        walletRepository.save(wallet);

        return AuthResponse.builder()
                .userId(user.getId())
                .email(user.getEmail())
                .role(user.getRole())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .isVerified(user.getIsVerified())
                .isApproved(user.getIsApproved())
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
                .isApproved(user.getIsApproved())
                .message("Login successful")
                .build();
    }

    @Transactional
    public void updateLicensePlate(Long userId, String licensePlate) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        user.setLicensePlate(licensePlate.trim().toUpperCase());
        userRepository.save(user);
    }
}
