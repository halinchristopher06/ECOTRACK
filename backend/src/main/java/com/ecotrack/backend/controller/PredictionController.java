package com.ecotrack.backend.controller;

import com.ecotrack.backend.dto.BillPredictionResponse;
import com.ecotrack.backend.model.UtilityType;
import com.ecotrack.backend.service.PredictionService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/predictions")
public class PredictionController {

    private final PredictionService predictionService;

    public PredictionController(PredictionService predictionService) {
        this.predictionService = predictionService;
    }

    @GetMapping("/upcoming")
    public BillPredictionResponse upcoming(
            @RequestHeader("X-Session-Token") String token,
            @RequestParam UtilityType utilityType
    ) {
        return predictionService.predictUpcomingBill(token, utilityType);
    }
}
