package com.ecotrack.backend.dto;

public record ApplianceCostBreakdown(
        String id,
        String name,
        String catalogId,
        int quantity,
        double wattage,
        double hoursPerDay,
        double daysPerMonth,
        double dailyEnergyKwh,
        double dailyCost,
        double monthlyEnergyKwh,
        double monthlyCost,
        double annualCost,
        boolean isHighestCost
) {
}
