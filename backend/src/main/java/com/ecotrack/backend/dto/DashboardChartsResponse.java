package com.ecotrack.backend.dto;

import java.util.List;

public record DashboardChartsResponse(
        List<MonthPoint> electricityByMonth,
        List<MonthPoint> waterByMonth,
        List<MonthPoint> expensesByMonth,
        UtilityTotals electricityVsWaterTotals,
        List<YearPoint> yearlyTrends
) {
    public record MonthPoint(String month, double units, double amount) {
    }

    public record UtilityTotals(double electricity, double water) {
    }

    public record YearPoint(String year, double units, double amount) {
    }
}
