package com.ecotrack.backend.controller;

import com.ecotrack.backend.model.Recommendation;
import com.ecotrack.backend.service.RecommendationService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/recommendations")
public class RecommendationController {

    private final RecommendationService recommendationService;

    public RecommendationController(RecommendationService recommendationService) {
        this.recommendationService = recommendationService;
    }

    @GetMapping
    public List<Recommendation> list(@RequestHeader("X-Session-Token") String token) {
        return recommendationService.getActiveRecommendations(token);
    }

    @PutMapping("/{id}/completed")
    public Recommendation setCompleted(
            @RequestHeader("X-Session-Token") String token,
            @PathVariable String id,
            @RequestParam boolean value
    ) {
        return recommendationService.markCompleted(token, id, value);
    }
}
