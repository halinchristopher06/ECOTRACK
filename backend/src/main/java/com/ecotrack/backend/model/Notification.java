package com.ecotrack.backend.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * One in-app notification row. Dedupe keys (one scheme per type, used by NotificationService /
 * NotificationScheduler to make sure the scheduler never creates the same logical notification
 * twice even if a job reruns):
 *  - PAYMENT_REMINDER:        "payment-reminder:" + billId + ":" + daysBefore
 *  - OVERDUE:                 "overdue:" + billId
 *  - BILL_UPLOAD_REMINDER:    "bill-upload-reminder:" + userId + ":" + yyyyMm
 *  - BUDGET_ALERT:            "budget:" + userId + ":" + utility + ":threshold-" + threshold + ":" + yyyyMm
 *  - ANOMALY_ALERT:           "anomaly:" + userId + ":" + utilityType + ":" + yyyyMm
 *  - MONTHLY_SUMMARY:         "monthly-summary:" + userId + ":" + yyyyMm
 */
@Document(collection = "notifications")
public class Notification {
    @Id
    private String id;

    @Indexed
    private String userId;

    private String type;
    private String title;
    private String message;

    @Indexed
    private String dedupeKey;

    private boolean emailSent;
    private boolean read;
    private Instant createdAt;

    public Notification() {}

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

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public String getDedupeKey() {
        return dedupeKey;
    }

    public void setDedupeKey(String dedupeKey) {
        this.dedupeKey = dedupeKey;
    }

    public boolean isEmailSent() {
        return emailSent;
    }

    public void setEmailSent(boolean emailSent) {
        this.emailSent = emailSent;
    }

    public boolean isRead() {
        return read;
    }

    public void setRead(boolean read) {
        this.read = read;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
