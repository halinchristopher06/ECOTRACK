package com.ecotrack.backend.model;

import java.util.List;

public record TariffPlan(String company, String consumer, String unit, String note, List<TariffSlab> slabs) {
}
