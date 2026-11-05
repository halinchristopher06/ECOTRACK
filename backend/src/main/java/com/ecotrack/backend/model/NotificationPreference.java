package com.ecotrack.backend.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/** One standing per-user notification-preferences row, same find-or-create-default pattern as Budget. */
@Document(collection = "notification_preferences")
public class NotificationPreference {
    @Id
    private String id;

    @Indexed
    private String userId;

    private boolean emailEnabled = true;
    private boolean paymentRemindersEnabled = true;
    private boolean overdueAlertsEnabled = true;
    private boolean budgetAlertsEnabled = true;
    private boolean anomalyAlertsEnabled = true;
    private boolean billUploadRemindersEnabled = true;
    private boolean monthlySummaryEnabled = true;
    private Instant updatedAt;

    public NotificationPreference() {}

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

    public boolean isEmailEnabled() {
        return emailEnabled;
    }

    public void setEmailEnabled(boolean emailEnabled) {
        this.emailEnabled = emailEnabled;
    }

    public boolean isPaymentRemindersEnabled() {
        return paymentRemindersEnabled;
    }

    public void setPaymentRemindersEnabled(boolean paymentRemindersEnabled) {
        this.paymentRemindersEnabled = paymentRemindersEnabled;
    }

    public boolean isOverdueAlertsEnabled() {
        return overdueAlertsEnabled;
    }

    public void setOverdueAlertsEnabled(boolean overdueAlertsEnabled) {
        this.overdueAlertsEnabled = overdueAlertsEnabled;
    }

    public boolean isBudgetAlertsEnabled() {
        return budgetAlertsEnabled;
    }

    public void setBudgetAlertsEnabled(boolean budgetAlertsEnabled) {
        this.budgetAlertsEnabled = budgetAlertsEnabled;
    }

    public boolean isAnomalyAlertsEnabled() {
        return anomalyAlertsEnabled;
    }

    public void setAnomalyAlertsEnabled(boolean anomalyAlertsEnabled) {
        this.anomalyAlertsEnabled = anomalyAlertsEnabled;
    }

    public boolean isBillUploadRemindersEnabled() {
        return billUploadRemindersEnabled;
    }

    public void setBillUploadRemindersEnabled(boolean billUploadRemindersEnabled) {
        this.billUploadRemindersEnabled = billUploadRemindersEnabled;
    }

    public boolean isMonthlySummaryEnabled() {
        return monthlySummaryEnabled;
    }

    public void setMonthlySummaryEnabled(boolean monthlySummaryEnabled) {
        this.monthlySummaryEnabled = monthlySummaryEnabled;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
