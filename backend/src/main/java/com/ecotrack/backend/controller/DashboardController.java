package com.ecotrack.backend.controller;

import com.ecotrack.backend.dto.DashboardChartsResponse;
import com.ecotrack.backend.dto.DashboardSummaryResponse;
import com.ecotrack.backend.service.DashboardService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    private final DashboardService dashboardService;

    public DashboardController(DashboardService dashboardService) {
        this.dashboardService = dashboardService;
    }

    @GetMapping("/summary")
    public DashboardSummaryResponse summary(@RequestHeader("X-Session-Token") String token) {
        return dashboardService.getSummary(token);
    }

    @GetMapping("/charts")
    public DashboardChartsResponse charts(@RequestHeader("X-Session-Token") String token) {
        return dashboardService.getCharts(token);
    }
}
