package com.ecotrack.backend.dto;

import java.util.List;

public record DashboardSummaryResponse(
        boolean hasAnyBills,
        double totalElectricityExpense,
        double totalWaterExpense,
        int pendingPaymentsCount,
        double pendingPaymentsTotal,
        List<UpcomingDue> upcomingDueDates,
        List<RecentBill> recentBills
) {
    public record UpcomingDue(String id, String provider, String utilityType, Double amount, String dueDate) {
    }

    public record RecentBill(String id, String provider, String utilityType, String billingMonth,
                              Double amount, String paymentStatus) {
    }
}
