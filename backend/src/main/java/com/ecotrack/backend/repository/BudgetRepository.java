package com.ecotrack.backend.repository;

import com.ecotrack.backend.model.Budget;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface BudgetRepository extends MongoRepository<Budget, String> {
    Optional<Budget> findByUserId(String userId);
}
