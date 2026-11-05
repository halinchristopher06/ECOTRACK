package com.ecotrack.backend.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * A persisted, completable recommendation surfaced from one of several generating sources
 * (appliance tips, budget alerts, anomaly detections). See RecommendationService for the
 * recommendationKey scheme used by each source so that regenerating the same underlying tip
 * updates this row in place instead of duplicating it.
 */
@Document(collection = "recommendations")
public class Recommendation {
    @Id
    private String id;

    @Indexed
    private String userId;

    private String recommendationKey;
    private String category;
    private String text;
    private boolean completed;
    private Instant createdAt;
    private Instant completedAt;

    public Recommendation() {}

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getRecommendationKey() {
        return recommendationKey;
    }

    public void setRecommendationKey(String recommendationKey) {
        this.recommendationKey = recommendationKey;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getText() {
        return text;
    }

    public void setText(String text) {
        this.text = text;
    }

    public boolean isCompleted() {
        return completed;
    }

    public void setCompleted(boolean completed) {
        this.completed = completed;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getCompletedAt() {
        return completedAt;
    }

    public void setCompletedAt(Instant completedAt) {
        this.completedAt = completedAt;
    }
}
