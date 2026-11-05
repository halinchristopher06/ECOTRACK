package com.ecotrack.backend.dto;

import java.util.List;

public record ApplianceEstimateRequest(List<ApplianceInput> rows) {
    public record ApplianceInput(
            String applianceId,
            double count,
            double hours,
            double wMin,
            double wMax
    ) {
    }
}
