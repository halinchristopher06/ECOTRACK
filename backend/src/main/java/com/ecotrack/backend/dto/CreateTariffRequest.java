package com.ecotrack.backend.dto;

import com.ecotrack.backend.model.TariffSlab;
import com.ecotrack.backend.model.UtilityType;

import java.util.List;

public record CreateTariffRequest(
        UtilityType utilityType,
        String providerName,
        String category,
        String unit,
        String note,
        List<TariffSlab> slabs,
        Double fixedCharges,
        Double taxesPercent,
        String effectiveFrom,
        String groupKey
) {
}
