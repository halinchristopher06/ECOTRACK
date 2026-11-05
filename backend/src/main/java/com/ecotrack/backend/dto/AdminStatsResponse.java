package com.ecotrack.backend.dto;

import java.util.List;
import java.util.Map;

/**
 * Aggregate system statistics for the admin analytics panel.
 *
 * signupsByMonth covers only the last 6 calendar months and only counts UserAccounts that have
 * a createdAt timestamp (accounts created before that field existed are excluded rather than
 * fabricated into a fake history) — see UserAccount.createdAt and AdminAnalyticsService.
 */
public record AdminStatsResponse(
        long totalUsers,
        long verifiedUsers,
        long unverifiedUsers,
        long totalBillsUploaded,
        long totalAppliancesTracked,
        Map<String, Long> usersByRole,
        List<MonthlySignupCount> signupsByMonth
) {
    public record MonthlySignupCount(String month, long count) {
    }
}
