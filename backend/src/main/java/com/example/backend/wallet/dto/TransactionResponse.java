package com.example.backend.wallet.dto;

import com.example.backend.wallet.entity.TransactionCategory;
import com.example.backend.wallet.entity.TransactionType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TransactionResponse {
    private Long id;
    private Long walletId;
    private TransactionType type;
    private TransactionCategory category;
    private Double amount;
    private Double balanceAfter;
    private String description;
    private String referenceId;
    private Long relatedUserId;
    private String relatedUserFirstName;
    private String relatedUserLastName;
    private LocalDateTime createdAt;
}
