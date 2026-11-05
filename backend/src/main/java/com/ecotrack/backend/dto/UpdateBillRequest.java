package com.ecotrack.backend.dto;

public record UpdateBillRequest(
        String provider,
        String utilityType,
        String billingMonth,
        String billingPeriodStart,
        String billingPeriodEnd,
        Double previousReading,
        Double currentReading,
        Double unitsConsumed,
        Double billAmount,
        Double fixedCharges,
        Double additionalCharges,
        String issueDate,
        String dueDate,
        String paymentStatus,
        String paymentDate
) {
}
