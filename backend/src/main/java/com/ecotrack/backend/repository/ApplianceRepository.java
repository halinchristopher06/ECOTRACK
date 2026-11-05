package com.ecotrack.backend.repository;

import com.ecotrack.backend.model.Appliance;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface ApplianceRepository extends MongoRepository<Appliance, String> {
    List<Appliance> findByUserId(String userId);
}
