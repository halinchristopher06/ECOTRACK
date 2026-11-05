package com.ecotrack.backend.dto;

import com.ecotrack.backend.model.TariffPlan;

import java.util.List;

public record TariffCatalogResponse(List<TariffPlan> electricity, List<TariffPlan> water) {
}
