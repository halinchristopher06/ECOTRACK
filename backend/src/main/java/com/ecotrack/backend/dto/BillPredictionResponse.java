package com.ecotrack.backend.dto;

public record BillPredictionResponse(
        boolean hasEnoughData,
        String confidence,
        Double predictedUnits,
        Double predictedAmount,
        Double estimatedAmountLow,
        Double estimatedAmountHigh,
        Double previousBillAmount,
        ActualVsPredicted actualVsPredictedCurrentMonth,
        String message
) {
    public record ActualVsPredicted(String month, double actualAmount, double predictedAmount) {
    }
}
