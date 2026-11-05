package com.ecotrack.backend.repository;

import com.ecotrack.backend.model.Bill;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface BillRepository extends MongoRepository<Bill, String> {
    List<Bill> findByUserId(String userId);

    Optional<Bill> findByIdAndUserId(String id, String userId);
}
