package com.example.backend.wallet.controller;

import com.example.backend.wallet.entity.Wallet;
import com.example.backend.wallet.repository.WalletRepository;
import com.example.backend.wallet.dto.TransactionResponse;
import com.example.backend.wallet.dto.TransferRequest;
import com.example.backend.wallet.dto.WalletResponse;
import com.example.backend.wallet.entity.Transaction;
import com.example.backend.wallet.entity.TransactionType;
import com.example.backend.wallet.service.WalletService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/wallet")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class WalletController {

    private final WalletService walletService;
    private final WalletRepository walletRepository;

    @GetMapping
    public ResponseEntity<?> getWallet(@RequestHeader("X-User-Id") Long userId) {
        Wallet wallet = walletService.getWallet(userId);
        return ResponseEntity.ok(Map.of("data", mapToResponse(wallet)));
    }

    @GetMapping("/transactions")
    public ResponseEntity<?> getTransactions(
            @RequestHeader("X-User-Id") Long userId,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) Integer limit) {
        TransactionType transactionType = type != null ? TransactionType.valueOf(type.toUpperCase()) : null;
        var transactionCategory = category != null ? com.example.backend.wallet.entity.TransactionCategory.valueOf(category.toUpperCase()) : null;
        List<Transaction> transactions = walletService.getTransactionHistory(userId, transactionType, transactionCategory, limit);
        List<TransactionResponse> responses = transactions.stream().map(this::mapToResponse).collect(Collectors.toList());
        return ResponseEntity.ok(Map.of("data", responses));
    }

    @PostMapping("/transfer")
    public ResponseEntity<?> transferCredits(
            @RequestHeader("X-User-Id") Long userId,
            @Valid @RequestBody TransferRequest request) {
        Transaction transaction = walletService.transferCredits(userId, request.getToUserId(), request.getAmount(), request.getDescription());
        return ResponseEntity.ok(Map.of("data", mapToResponse(transaction)));
    }

    @GetMapping("/stats")
    public ResponseEntity<?> getWalletStats(@RequestHeader("X-User-Id") Long userId) {
        Wallet wallet = walletService.getWallet(userId);
        List<Transaction> allTransactions = walletService.getTransactionHistory(userId, null, null, null);
        Map<String, Object> stats = Map.of(
                "balance", wallet.getBalance(),
                "totalEarned", wallet.getTotalEarned(),
                "totalSpent", wallet.getTotalSpent(),
                "totalTransactions", (long) allTransactions.size(),
                "earnCount", allTransactions.stream().filter(t -> t.getType() == TransactionType.EARN).count(),
                "spendCount", allTransactions.stream().filter(t -> t.getType() == TransactionType.SPEND).count());
        return ResponseEntity.ok(Map.of("data", stats));
    }

    @PutMapping("/admin/top-up")
    public ResponseEntity<?> manualTopUp(
            @RequestHeader("X-User-Id") Long adminId,
            @RequestParam Long userId,
            @RequestParam Double amount) {
        Wallet wallet = walletService.getOrCreateWallet(userId);
        wallet.setBalance(wallet.getBalance() + amount);
        wallet.setTotalEarned(wallet.getTotalEarned() + amount);
        wallet = walletRepository.save(wallet);
        return ResponseEntity.ok(Map.of("message", "Credits added successfully", "newBalance", wallet.getBalance(), "amountAdded", amount));
    }

    private WalletResponse mapToResponse(Wallet wallet) {
        return WalletResponse.builder()
                .id(wallet.getId())
                .userId(wallet.getUser().getId())
                .balance(wallet.getBalance())
                .totalEarned(wallet.getTotalEarned())
                .totalSpent(wallet.getTotalSpent())
                .createdAt(wallet.getCreatedAt())
                .updatedAt(wallet.getUpdatedAt())
                .build();
    }

    private TransactionResponse mapToResponse(Transaction transaction) {
        var builder = TransactionResponse.builder()
                .id(transaction.getId())
                .walletId(transaction.getWallet().getId())
                .type(transaction.getType())
                .category(transaction.getCategory())
                .amount(transaction.getAmount())
                .balanceAfter(transaction.getBalanceAfter())
                .description(transaction.getDescription())
                .referenceId(transaction.getReferenceId())
                .createdAt(transaction.getCreatedAt());
        if (transaction.getRelatedUser() != null) {
            builder.relatedUserId(transaction.getRelatedUser().getId())
                    .relatedUserFirstName(transaction.getRelatedUser().getFirstName())
                    .relatedUserLastName(transaction.getRelatedUser().getLastName());
        }
        return builder.build();
    }
}
