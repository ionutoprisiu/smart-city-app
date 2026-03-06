package com.example.backend.wallet.repository;

import com.example.backend.user.entity.User;
import com.example.backend.wallet.entity.Wallet;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface WalletRepository extends JpaRepository<Wallet, Long> {
    Optional<Wallet> findByUser(User user);
    Optional<Wallet> findByUser_Id(Long userId);
    boolean existsByUser_Id(Long userId);
}
