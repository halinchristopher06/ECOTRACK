package com.ecotrack.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;

public record CreateBillRequest(
        String provider,
        @NotBlank(message = "utilityType is required") String utilityType,
        @NotBlank(message = "billingMonth is required") String billingMonth,
        String billingPeriodStart,
        String billingPeriodEnd,
        @PositiveOrZero(message = "previousReading must not be negative") Double previousReading,
        @PositiveOrZero(message = "currentReading must not be negative") Double currentReading,
        @PositiveOrZero(message = "unitsConsumed must not be negative") Double unitsConsumed,
        @PositiveOrZero(message = "billAmount must not be negative") Double billAmount,
        @PositiveOrZero(message = "fixedCharges must not be negative") Double fixedCharges,
        @PositiveOrZero(message = "additionalCharges must not be negative") Double additionalCharges,
        String issueDate,
        String dueDate,
        String paymentStatus,
        String paymentDate,
        String documentPath,
        String documentOriginalName,
        String entrySource
) {
}
