package com.ecotrack.backend.dto;

import java.util.List;

public record BudgetStatusResponse(
        String currentMonth,
        double currentElectricityExpense,
        double currentWaterExpense,
        double currentCombinedExpense,
        double electricityBudget,
        double waterBudget,
        double combinedBudget,
        double electricityPercentUsed,
        double waterPercentUsed,
        double combinedPercentUsed,
        Double predictedMonthEndElectricity,
        Double predictedMonthEndWater,
        List<String> triggeredAlerts
) {
}
