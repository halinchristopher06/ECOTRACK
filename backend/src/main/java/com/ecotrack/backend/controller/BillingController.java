package com.ecotrack.backend.controller;

import com.ecotrack.backend.dto.ApplianceEstimateRequest;
import com.ecotrack.backend.dto.ApplianceEstimateResponse;
import com.ecotrack.backend.dto.BillingEstimateRequest;
import com.ecotrack.backend.dto.BillingEstimateResponse;
import com.ecotrack.backend.dto.TariffCatalogResponse;
import com.ecotrack.backend.service.BillingService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/billing")
public class BillingController {

    private final BillingService billingService;

    public BillingController(BillingService billingService) {
        this.billingService = billingService;
    }

    @PostMapping("/estimate")
    public BillingEstimateResponse estimate(@RequestBody BillingEstimateRequest request) {
        return billingService.estimate(request);
    }

    @PostMapping("/appliances/estimate")
    public ApplianceEstimateResponse estimateAppliances(@RequestBody ApplianceEstimateRequest request) {
        return billingService.estimateAppliances(request);
    }

    @GetMapping("/tariffs")
    public TariffCatalogResponse tariffs() {
        return billingService.getTariffs();
    }
}
