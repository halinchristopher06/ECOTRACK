package com.ecotrack.backend.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;

/**
 * One standing budget configuration per user (not per month) — re-evaluated against whichever
 * calendar month is "current" each time it is queried by BudgetService.
 */
@Document(collection = "budgets")
public class Budget {
    @Id
    private String id;

    @Indexed(unique = true)
    private String userId;

    private Double electricityBudget;
    private Double waterBudget;
    private List<Integer> alertThresholds;
    private Instant updatedAt;

    public Budget() {}

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public Double getElectricityBudget() {
        return electricityBudget;
    }

    public void setElectricityBudget(Double electricityBudget) {
        this.electricityBudget = electricityBudget;
    }

    public Double getWaterBudget() {
        return waterBudget;
    }

    public void setWaterBudget(Double waterBudget) {
        this.waterBudget = waterBudget;
    }

    public List<Integer> getAlertThresholds() {
        return alertThresholds;
    }

    public void setAlertThresholds(List<Integer> alertThresholds) {
        this.alertThresholds = alertThresholds;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
