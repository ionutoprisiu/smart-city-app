package com.example.backend.wallet.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WalletResponse {
    private Long id;
    private Long userId;
    private Double balance;
    private Double totalEarned;
    private Double totalSpent;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
