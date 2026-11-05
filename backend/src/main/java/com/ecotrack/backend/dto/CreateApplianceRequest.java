package com.ecotrack.backend.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;

public record CreateApplianceRequest(
        @NotBlank(message = "name is required") String name,
        String catalogId,
        @Positive(message = "quantity must be a positive number") Integer quantity,
        @Positive(message = "wattage must be a positive number") Double wattage,
        @DecimalMin(value = "0", message = "hoursPerDay must be between 0 and 24")
        @DecimalMax(value = "24", message = "hoursPerDay must be between 0 and 24") Double hoursPerDay,
        @Positive(message = "daysPerMonth must be a positive number") Double daysPerMonth
) {
}
