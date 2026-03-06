package com.example.backend.user.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "users")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String email;

    @Column(nullable = false)
    private String password;

    @Column(nullable = false)
    private String firstName;

    @Column(nullable = false)
    private String lastName;

    @Column(name = "name", nullable = false, length = 500)
    private String name;

    private String phoneNumber;

    @Column(length = 500)
    private String address;

    @Column(length = 20)
    private String licensePlate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role;

    @Column(nullable = false)
    @Builder.Default
    private Boolean isVerified = false;

    @Column(nullable = false)
    @Builder.Default
    private Boolean isApproved = false;

    @Column(length = 500)
    private String idCardImageUrl;

    private LocalDateTime createdAt;

    private LocalDateTime approvedAt;

    private LocalDateTime lastLogin;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        syncName();
    }

    @PreUpdate
    protected void onUpdate() {
        syncName();
    }

    private void syncName() {
        String first = firstName != null ? firstName.trim() : "";
        String last = lastName != null ? lastName.trim() : "";
        this.name = (first + " " + last).trim();
        if (this.name.isEmpty()) this.name = " ";
    }
}
