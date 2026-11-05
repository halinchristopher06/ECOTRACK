package com.ecotrack.backend.dto;

import java.util.List;

public record AnomalyCheckResponse(
        boolean hasEnoughData,
        boolean isUnusual,
        Double currentConsumption,
        Double historicalAverage,
        Double percentIncrease,
        List<String> possibleCauses,
        List<String> recommendedActions,
        String message
) {
}
