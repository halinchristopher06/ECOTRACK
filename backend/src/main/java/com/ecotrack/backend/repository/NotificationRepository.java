package com.ecotrack.backend.repository;

import com.ecotrack.backend.model.Notification;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface NotificationRepository extends MongoRepository<Notification, String> {
    List<Notification> findByUserId(String userId);

    boolean existsByUserIdAndDedupeKey(String userId, String dedupeKey);
}
