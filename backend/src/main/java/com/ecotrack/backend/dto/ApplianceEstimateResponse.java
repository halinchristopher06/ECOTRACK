package com.ecotrack.backend.dto;

public record ApplianceEstimateResponse(
        double low,
        double high,
        double rate,
        String tariffName
) {
}
