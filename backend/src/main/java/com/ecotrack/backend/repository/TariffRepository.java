package com.ecotrack.backend.repository;

import com.ecotrack.backend.model.TariffConfig;
import com.ecotrack.backend.model.UtilityType;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TariffRepository extends MongoRepository<TariffConfig, String> {
    List<TariffConfig> findByUtilityType(UtilityType utilityType);
    List<TariffConfig> findByGroupKey(String groupKey);
    List<TariffConfig> findByUtilityTypeAndActiveTrue(UtilityType utilityType);
}
