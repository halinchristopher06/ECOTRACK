package com.ecotrack.backend.dto;

public record UpdateNotificationPreferenceRequest(
        Boolean emailEnabled,
        Boolean paymentRemindersEnabled,
        Boolean overdueAlertsEnabled,
        Boolean budgetAlertsEnabled,
        Boolean anomalyAlertsEnabled,
        Boolean billUploadRemindersEnabled,
        Boolean monthlySummaryEnabled
) {
}
