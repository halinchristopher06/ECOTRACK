package com.ecotrack.backend.service;

import com.ecotrack.backend.dto.ApplianceEstimateRequest;
import com.ecotrack.backend.dto.ApplianceEstimateResponse;
import com.ecotrack.backend.dto.BillingEstimateRequest;
import com.ecotrack.backend.dto.BillingEstimateResponse;
import com.ecotrack.backend.dto.TariffCatalogResponse;
import com.ecotrack.backend.model.TariffConfig;
import org.springframework.stereotype.Service;

@Service
public class BillingService {

    private final TariffAdminService tariffAdminService;

    public BillingService(TariffAdminService tariffAdminService) {
        this.tariffAdminService = tariffAdminService;
    }

    public BillingEstimateResponse estimate(BillingEstimateRequest request) {
        double electricityUnits = sanitizeUnits(request.electricityUnits());
        double waterUnits = sanitizeUnits(request.waterUnits());

        TariffConfig electricityTariff = tariffAdminService.getDefaultElectricityTariff();
        TariffConfig waterTariff = tariffAdminService.getDefaultWaterTariff();

        double electricityAmount = TariffCalculator.calculateSlabCharge(electricityUnits, electricityTariff.getSlabs());
        double waterAmount = TariffCalculator.calculateSlabCharge(waterUnits, waterTariff.getSlabs());

        BillingEstimateResponse.EstimateLine electricity = new BillingEstimateResponse.EstimateLine(
                electricityUnits,
                round2(electricityAmount),
                electricityUnits > 0 ? round2(electricityAmount / electricityUnits) : 0,
                electricityTariff.getProviderName(),
                electricityTariff.getUnit()
        );
        BillingEstimateResponse.EstimateLine water = new BillingEstimateResponse.EstimateLine(
                waterUnits,
                round2(waterAmount),
                waterUnits > 0 ? round2(waterAmount / waterUnits) : 0,
                waterTariff.getProviderName(),
                waterTariff.getUnit()
        );

        return new BillingEstimateResponse(electricity, water, round2(electricity.amount() + water.amount()));
    }

    public ApplianceEstimateResponse estimateAppliances(ApplianceEstimateRequest request) {
        TariffConfig electricityTariff = tariffAdminService.getDefaultElectricityTariff();
        double electricityRate = electricityTariff.getSlabs().get(0).rate();
        double low = 0;
        double high = 0;

        if (request.rows() != null) {
            for (ApplianceEstimateRequest.ApplianceInput row : request.rows()) {
                double count = Math.max(0, row.count());
                double hours = Math.max(0, row.hours());
                double minWatt = Math.max(0, row.wMin());
                double maxWatt = Math.max(minWatt, row.wMax());
                double days = 30;

                low += (minWatt / 1000.0) * hours * count * days * electricityRate;
                high += (maxWatt / 1000.0) * hours * count * days * electricityRate;
            }
        }

        return new ApplianceEstimateResponse(
                round2(low),
                round2(high),
                electricityRate,
                electricityTariff.getProviderName()
        );
    }

    public TariffCatalogResponse getTariffs() {
        return tariffAdminService.getPublicCatalog();
    }

    private double sanitizeUnits(Double units) {
        if (units == null || Double.isNaN(units) || Double.isInfinite(units)) {
            return 0;
        }
        return Math.max(0, units);
    }

    private double round2(double value) {
        return TariffCalculator.round2(value);
    }
}
