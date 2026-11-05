package com.ecotrack.backend.controller;

import com.ecotrack.backend.dto.AdminStatsResponse;
import com.ecotrack.backend.dto.AdminUserResponse;
import com.ecotrack.backend.model.HistoryRecord;
import com.ecotrack.backend.service.AdminAnalyticsService;
import com.ecotrack.backend.service.AuthService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/auth/admin")
public class AdminController {

    private final AuthService authService;
    private final AdminAnalyticsService adminAnalyticsService;

    public AdminController(AuthService authService, AdminAnalyticsService adminAnalyticsService) {
        this.authService = authService;
        this.adminAnalyticsService = adminAnalyticsService;
    }

    // Matches this controller's existing /api/auth/admin/* prefix convention.
    @GetMapping("/stats")
    public AdminStatsResponse stats(@RequestHeader("X-Session-Token") String token) {
        return adminAnalyticsService.getStats(token);
    }

    @GetMapping("/users")
    public List<AdminUserResponse> users(@RequestHeader("X-Session-Token") String token) {
        return authService.listUsers(token);
    }

    @GetMapping("/users/{userId}/history")
    public List<HistoryRecord> userHistory(
            @RequestHeader("X-Session-Token") String token,
            @PathVariable String userId
    ) {
        return authService.getUserHistory(token, userId);
    }

}
