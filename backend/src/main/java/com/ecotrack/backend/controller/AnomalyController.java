package com.ecotrack.backend.controller;

import com.ecotrack.backend.dto.AnomalyCheckResponse;
import com.ecotrack.backend.service.AnomalyDetectionService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/anomalies")
public class AnomalyController {

    private final AnomalyDetectionService anomalyDetectionService;

    public AnomalyController(AnomalyDetectionService anomalyDetectionService) {
        this.anomalyDetectionService = anomalyDetectionService;
    }

    @GetMapping("/check")
    public AnomalyCheckResponse check(
            @RequestHeader("X-Session-Token") String token,
            @RequestParam String utilityType
    ) {
        return anomalyDetectionService.checkUnusualConsumption(token, utilityType);
    }
}
