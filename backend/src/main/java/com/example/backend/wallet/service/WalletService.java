package com.example.backend.wallet.service;

import com.example.backend.user.entity.User;
import com.example.backend.user.repository.UserRepository;
import com.example.backend.wallet.entity.Wallet;
import com.example.backend.wallet.repository.WalletRepository;
import com.example.backend.wallet.entity.Transaction;
import com.example.backend.wallet.entity.TransactionCategory;
import com.example.backend.wallet.entity.TransactionType;
import com.example.backend.wallet.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class WalletService {

    private final WalletRepository walletRepository;
    private final TransactionRepository transactionRepository;
    private final UserRepository userRepository;

    private static final Double ISSUE_REWARD_AMOUNT = 50.0;

    @Transactional
    public Wallet getOrCreateWallet(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        Optional<Wallet> walletOpt = walletRepository.findByUser(user);

        if (walletOpt.isPresent()) {
            return walletOpt.get();
        }

        Wallet wallet = Wallet.builder()
                .user(user)
                .balance(0.0)
                .totalEarned(0.0)
                .totalSpent(0.0)
                .build();

        return walletRepository.save(wallet);
    }

    public Wallet getWallet(Long userId) {
        return getOrCreateWallet(userId);
    }

    @Transactional
    public Transaction addCredits(Long userId, Double amount, TransactionCategory category, String description,
            String referenceId) {
        if (amount == null || amount <= 0) {
            throw new RuntimeException("Amount must be positive");
        }

        if (amount > 1000000.0) {
            throw new RuntimeException("Amount exceeds maximum limit");
        }

        Wallet wallet = getOrCreateWallet(userId);

        wallet.setBalance(wallet.getBalance() + amount);
        wallet.setTotalEarned(wallet.getTotalEarned() + amount);
        wallet = walletRepository.save(wallet);

        Transaction transaction = Transaction.builder()
                .wallet(wallet)
                .type(TransactionType.EARN)
                .category(category)
                .amount(amount)
                .balanceAfter(wallet.getBalance())
                .description(description != null ? description : getDefaultDescription(category))
                .referenceId(referenceId)
                .build();

        return transactionRepository.save(transaction);
    }

    @Transactional
    public Transaction withdrawCredits(Long userId, Double amount, TransactionCategory category, String description,
            String referenceId) {
        if (amount == null || amount <= 0) {
            throw new RuntimeException("Amount must be positive");
        }

        Wallet wallet = getOrCreateWallet(userId);

        if (wallet.getBalance() < amount) {
            throw new RuntimeException(
                    "Insufficient credits. Current balance: " + String.format("%.0f", wallet.getBalance()));
        }

        wallet.setBalance(wallet.getBalance() - amount);
        wallet.setTotalSpent(wallet.getTotalSpent() + amount);
        wallet = walletRepository.save(wallet);

        Transaction transaction = Transaction.builder()
                .wallet(wallet)
                .type(TransactionType.SPEND)
                .category(category)
                .amount(-amount)
                .balanceAfter(wallet.getBalance())
                .description(description != null ? description : getDefaultDescription(category))
                .referenceId(referenceId)
                .build();

        return transactionRepository.save(transaction);
    }

    private static final Double MIN_TRANSFER_AMOUNT = 1.0;
    private static final Double MAX_TRANSFER_AMOUNT = 10000.0;

    @Transactional
    public Transaction transferCredits(Long fromUserId, Long toUserId, Double amount, String description) {
        if (amount == null || amount <= 0) {
            throw new RuntimeException("Amount must be positive");
        }

        if (amount < MIN_TRANSFER_AMOUNT) {
            throw new RuntimeException("Minimum transfer amount is " + MIN_TRANSFER_AMOUNT + " credits");
        }

        if (amount > MAX_TRANSFER_AMOUNT) {
            throw new RuntimeException("Maximum transfer amount is " + MAX_TRANSFER_AMOUNT + " credits");
        }

        if (fromUserId.equals(toUserId)) {
            throw new RuntimeException("Cannot transfer to yourself");
        }

        User toUser = userRepository.findById(toUserId)
                .orElseThrow(() -> new RuntimeException("Recipient user not found"));

        Wallet fromWallet = getOrCreateWallet(fromUserId);
        if (fromWallet.getBalance() < amount) {
            throw new RuntimeException("Insufficient credits for transfer");
        }

        fromWallet.setBalance(fromWallet.getBalance() - amount);
        fromWallet.setTotalSpent(fromWallet.getTotalSpent() + amount);
        fromWallet = walletRepository.save(fromWallet);

        Wallet toWallet = getOrCreateWallet(toUserId);
        toWallet.setBalance(toWallet.getBalance() + amount);
        toWallet.setTotalEarned(toWallet.getTotalEarned() + amount);
        toWallet = walletRepository.save(toWallet);

        Transaction fromTransaction = Transaction.builder()
                .wallet(fromWallet)
                .type(TransactionType.TRANSFER)
                .category(TransactionCategory.USER_TRANSFER)
                .amount(-amount)
                .balanceAfter(fromWallet.getBalance())
                .description(description != null ? description
                        : "Transfer to " + toUser.getFirstName() + " " + toUser.getLastName())
                .relatedUser(toUser)
                .build();
        transactionRepository.save(fromTransaction);

        Transaction toTransaction = Transaction.builder()
                .wallet(toWallet)
                .type(TransactionType.TRANSFER)
                .category(TransactionCategory.USER_TRANSFER)
                .amount(amount)
                .balanceAfter(toWallet.getBalance())
                .description(description != null ? description
                        : "Transfer from " + fromWallet.getUser().getFirstName() + " "
                                + fromWallet.getUser().getLastName())
                .relatedUser(fromWallet.getUser())
                .build();

        return transactionRepository.save(toTransaction);
    }

    @Transactional
    public Transaction rewardIssueResolution(Long userId, Long issueId, String issueDescription) {
        if (issueId == null) {
            throw new RuntimeException("Issue ID is required for reward");
        }

        Wallet wallet = getOrCreateWallet(userId);

        List<Transaction> existingRewards = transactionRepository.findByWalletAndReferenceIdOrderByCreatedAtDesc(
                wallet,
                issueId.toString());

        boolean alreadyRewarded = existingRewards.stream()
                .anyMatch(t -> t.getCategory() == TransactionCategory.ISSUE_REWARD
                        && t.getType() == TransactionType.EARN);

        if (alreadyRewarded) {
            throw new RuntimeException("Reward already granted for this issue");
        }

        String description = "Issue resolved reward: " +
                (issueDescription != null ? issueDescription.substring(0, Math.min(50, issueDescription.length()))
                        : "Issue");

        Transaction transaction = addCredits(
                userId,
                ISSUE_REWARD_AMOUNT,
                TransactionCategory.ISSUE_REWARD,
                description,
                issueId.toString());
        return transaction;
    }

    public List<Transaction> getTransactionHistory(Long userId, TransactionType type, TransactionCategory category,
            Integer limit) {
        Wallet wallet = getOrCreateWallet(userId);

        List<Transaction> transactions;

        if (type != null && category != null) {
            transactions = transactionRepository.findByWalletAndTypeOrderByCreatedAtDesc(wallet, type);
            transactions = transactions.stream()
                    .filter(t -> t.getCategory() == category)
                    .toList();
        } else if (type != null) {
            transactions = transactionRepository.findByWalletAndTypeOrderByCreatedAtDesc(wallet, type);
        } else if (category != null) {
            transactions = transactionRepository.findByWalletAndCategoryOrderByCreatedAtDesc(wallet, category);
        } else {
            transactions = transactionRepository.findByWalletOrderByCreatedAtDesc(wallet);
        }

        if (limit != null && limit > 0) {
            transactions = transactions.stream().limit(limit).toList();
        }

        return transactions;
    }

    private String getDefaultDescription(TransactionCategory category) {
        return switch (category) {
            case ISSUE_REWARD -> "Issue resolved reward";
            case EVENT_PARTICIPATION -> "Event participation";
            case PARKING -> "Parking payment";
            case TRANSPORT -> "Transport payment";
            case USER_TRANSFER -> "User transfer";
            default -> "Transaction " + category.name();
        };
    }
}
