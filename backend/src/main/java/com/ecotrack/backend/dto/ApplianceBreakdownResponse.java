package com.ecotrack.backend.dto;

import java.util.List;

public record ApplianceBreakdownResponse(
        List<ApplianceCostBreakdown> appliances,
        double totalMonthlyCost,
        double totalAnnualCost,
        List<String> recommendations,
        boolean empty
) {
}
