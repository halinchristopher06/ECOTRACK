package com.ecotrack.backend.dto;

import jakarta.validation.constraints.PositiveOrZero;

import java.util.List;

public record UpdateBudgetRequest(
        @PositiveOrZero(message = "electricityBudget must not be negative") Double electricityBudget,
        @PositiveOrZero(message = "waterBudget must not be negative") Double waterBudget,
        List<Integer> alertThresholds
) {
}
