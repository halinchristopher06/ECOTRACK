package com.ecotrack.backend.dto;

public record BillingEstimateResponse(
        EstimateLine electricity,
        EstimateLine water,
        double total
) {
    public record EstimateLine(
            double units,
            double amount,
            double averageRate,
            String tariffName,
            String unit
    ) {
    }
}
