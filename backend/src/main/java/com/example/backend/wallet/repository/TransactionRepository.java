package com.example.backend.wallet.repository;

import com.example.backend.wallet.entity.Wallet;
import com.example.backend.wallet.entity.Transaction;
import com.example.backend.wallet.entity.TransactionCategory;
import com.example.backend.wallet.entity.TransactionType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface TransactionRepository extends JpaRepository<Transaction, Long> {
    
    List<Transaction> findByWalletOrderByCreatedAtDesc(Wallet wallet);
    
    List<Transaction> findByWalletAndTypeOrderByCreatedAtDesc(Wallet wallet, TransactionType type);
    
    List<Transaction> findByWalletAndCategoryOrderByCreatedAtDesc(Wallet wallet, TransactionCategory category);
    
    @Query("SELECT t FROM Transaction t WHERE t.wallet = :wallet AND t.createdAt BETWEEN :start AND :end ORDER BY t.createdAt DESC")
    List<Transaction> findByWalletAndDateRange(
        @Param("wallet") Wallet wallet,
        @Param("start") LocalDateTime start,
        @Param("end") LocalDateTime end
    );
    
    List<Transaction> findByWalletAndReferenceIdOrderByCreatedAtDesc(Wallet wallet, String referenceId);
    
    long countByWallet(Wallet wallet);
}
