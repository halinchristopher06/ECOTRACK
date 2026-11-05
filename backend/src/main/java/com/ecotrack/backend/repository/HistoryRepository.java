package com.ecotrack.backend.repository;

import com.ecotrack.backend.model.HistoryRecord;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface HistoryRepository extends MongoRepository<HistoryRecord, String> {
    List<HistoryRecord> findByUserId(String userId);
}
