package com.ecotrack.backend.dto;

public record UpdateApplianceRequest(
        String name,
        String catalogId,
        Integer quantity,
        Double wattage,
        Double hoursPerDay,
        Double daysPerMonth
) {
}
