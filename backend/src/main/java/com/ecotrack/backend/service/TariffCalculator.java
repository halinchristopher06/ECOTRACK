package com.ecotrack.backend.service;

import com.ecotrack.backend.model.TariffConfig;
import com.ecotrack.backend.model.TariffSlab;

import java.util.List;

/**
 * Shared slab-billing math used by both BillingService (manual what-if estimates) and
 * PredictionService (bill forecasting), so the calculation only lives in one place.
 */
public final class TariffCalculator {

    private TariffCalculator() {
    }

    /** Sums the energy/water charge for the given consumption across a slab table. */
    public static double calculateSlabCharge(double units, List<TariffSlab> slabs) {
        double remaining = units;
        double previousCap = 0;
        double total = 0;

        for (TariffSlab slab : slabs) {
            if (remaining <= 0) {
                break;
            }

            if (slab.upto() == null) {
                total += remaining * slab.rate();
                remaining = 0;
                break;
            }

            double slabSize = Math.max(0, slab.upto() - previousCap);
            double billableUnits = Math.min(remaining, slabSize);
            total += billableUnits * slab.rate();
            remaining -= billableUnits;
            previousCap = slab.upto();
        }

        return total;
    }

    /** Full bill amount for a tariff: slab charge + fixed charges, with taxes applied on top. */
    public static double calculateBillAmount(double units, TariffConfig tariff) {
        double slabCharge = calculateSlabCharge(units, tariff.getSlabs());
        double fixed = tariff.getFixedCharges() == null ? 0 : tariff.getFixedCharges();
        double taxesPercent = tariff.getTaxesPercent() == null ? 0 : tariff.getTaxesPercent();
        double subtotal = slabCharge + fixed;
        return subtotal * (1 + taxesPercent / 100.0);
    }

    public static double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}
