package com.ecotrack.backend.controller;

import com.ecotrack.backend.dto.BudgetStatusResponse;
import com.ecotrack.backend.dto.UpdateBudgetRequest;
import com.ecotrack.backend.model.Budget;
import com.ecotrack.backend.service.BudgetService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/budget")
public class BudgetController {

    private final BudgetService budgetService;

    public BudgetController(BudgetService budgetService) {
        this.budgetService = budgetService;
    }

    @GetMapping
    public Budget getBudget(@RequestHeader("X-Session-Token") String token) {
        return budgetService.getOrCreateDefault(token);
    }

    @PutMapping
    public Budget updateBudget(@RequestHeader("X-Session-Token") String token, @Valid @RequestBody UpdateBudgetRequest request) {
        return budgetService.updateBudget(token, request);
    }

    @GetMapping("/status")
    public BudgetStatusResponse status(@RequestHeader("X-Session-Token") String token) {
        return budgetService.getStatus(token);
    }
}
