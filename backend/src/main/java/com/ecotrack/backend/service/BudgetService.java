package com.ecotrack.backend.service;

import com.ecotrack.backend.dto.BudgetStatusResponse;
import com.ecotrack.backend.dto.UpdateBudgetRequest;
import com.ecotrack.backend.model.Bill;
import com.ecotrack.backend.model.Budget;
import com.ecotrack.backend.model.UserAccount;
import com.ecotrack.backend.model.UtilityType;
import com.ecotrack.backend.repository.BillRepository;
import com.ecotrack.backend.repository.BudgetRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Smart Budget Management: one standing per-user budget configuration, re-evaluated against the
 * current calendar month on every status read (not persisted per-month).
 */
@Service
public class BudgetService {

    private static final List<Integer> DEFAULT_THRESHOLDS = List.of(50, 80, 100);

    private final BudgetRepository budgetRepository;
    private final BillRepository billRepository;
    private final AuthService authService;
    private final PredictionService predictionService;

    public BudgetService(
            BudgetRepository budgetRepository,
            BillRepository billRepository,
            AuthService authService,
            PredictionService predictionService
    ) {
        this.budgetRepository = budgetRepository;
        this.billRepository = billRepository;
        this.authService = authService;
        this.predictionService = predictionService;
    }

    public Budget getOrCreateDefault(String token) {
        UserAccount user = authService.requireUser(token);
        return getOrCreateDefaultForUser(user.getId());
    }

    private Budget getOrCreateDefaultForUser(String userId) {
        return budgetRepository.findByUserId(userId).orElseGet(() -> {
            Budget budget = new Budget();
            budget.setId(UUID.randomUUID().toString());
            budget.setUserId(userId);
            budget.setElectricityBudget(0.0);
            budget.setWaterBudget(0.0);
            budget.setAlertThresholds(DEFAULT_THRESHOLDS);
            budget.setUpdatedAt(Instant.now());
            return budgetRepository.save(budget);
        });
    }

    public Budget updateBudget(String token, UpdateBudgetRequest request) {
        UserAccount user = authService.requireUser(token);
        Budget budget = getOrCreateDefaultForUser(user.getId());
        if (request.electricityBudget() != null) budget.setElectricityBudget(request.electricityBudget());
        if (request.waterBudget() != null) budget.setWaterBudget(request.waterBudget());
        if (request.alertThresholds() != null && !request.alertThresholds().isEmpty()) {
            budget.setAlertThresholds(request.alertThresholds());
        }
        budget.setUpdatedAt(Instant.now());
        return budgetRepository.save(budget);
    }

    public BudgetStatusResponse getStatus(String token) {
        UserAccount user = authService.requireUser(token);
        ComputedStatus computed = computeStatus(user);
        Double predictedElectricity = predictedMonthEnd(token, UtilityType.ELECTRICITY, computed.currentElectricityExpense, computed.currentMonth);
        Double predictedWater = predictedMonthEnd(token, UtilityType.WATER, computed.currentWaterExpense, computed.currentMonth);

        List<String> alerts = computed.hits.stream().map(ThresholdHit::message).toList();

        return new BudgetStatusResponse(
                computed.currentMonthStr,
                round2(computed.currentElectricityExpense),
                round2(computed.currentWaterExpense),
                round2(computed.currentCombinedExpense),
                round2(computed.electricityBudget),
                round2(computed.waterBudget),
                round2(computed.combinedBudget),
                round2(computed.electricityPercentUsed),
                round2(computed.waterPercentUsed),
                round2(computed.combinedPercentUsed),
                predictedElectricity == null ? null : round2(predictedElectricity),
                predictedWater == null ? null : round2(predictedWater),
                alerts
        );
    }

    /** Shared core: computes this month's expenses/budgets/threshold-hits for a given user, token-free. */
    private ComputedStatus computeStatus(UserAccount user) {
        Budget budget = getOrCreateDefaultForUser(user.getId());
        YearMonth currentMonth = YearMonth.now();
        String currentMonthStr = currentMonth.toString();
        List<Bill> bills = billRepository.findByUserId(user.getId());

        double currentElectricityExpense = bills.stream()
                .filter(b -> currentMonthStr.equals(b.getBillingMonth()))
                .filter(b -> "ELECTRICITY".equalsIgnoreCase(b.getUtilityType()))
                .mapToDouble(b -> nz(b.getBillAmount()))
                .sum();
        double currentWaterExpense = bills.stream()
                .filter(b -> currentMonthStr.equals(b.getBillingMonth()))
                .filter(b -> "WATER".equalsIgnoreCase(b.getUtilityType()))
                .mapToDouble(b -> nz(b.getBillAmount()))
                .sum();
        double currentCombinedExpense = currentElectricityExpense + currentWaterExpense;

        double electricityBudget = nz(budget.getElectricityBudget());
        double waterBudget = nz(budget.getWaterBudget());
        double combinedBudget = electricityBudget + waterBudget;

        double electricityPercentUsed = percentUsed(currentElectricityExpense, electricityBudget);
        double waterPercentUsed = percentUsed(currentWaterExpense, waterBudget);
        double combinedPercentUsed = percentUsed(currentCombinedExpense, combinedBudget);

        List<Integer> thresholds = budget.getAlertThresholds() != null && !budget.getAlertThresholds().isEmpty()
                ? budget.getAlertThresholds()
                : DEFAULT_THRESHOLDS;

        List<ThresholdHit> hits = new ArrayList<>();
        addHighestThresholdHit(hits, "electricity", "Electricity", electricityBudget, electricityPercentUsed, thresholds);
        addHighestThresholdHit(hits, "water", "Water", waterBudget, waterPercentUsed, thresholds);
        addHighestThresholdHit(hits, "combined", "Combined", combinedBudget, combinedPercentUsed, thresholds);

        return new ComputedStatus(currentMonth, currentMonthStr, currentElectricityExpense, currentWaterExpense,
                currentCombinedExpense, electricityBudget, waterBudget, combinedBudget,
                electricityPercentUsed, waterPercentUsed, combinedPercentUsed, hits);
    }

    private record ComputedStatus(
            YearMonth currentMonth,
            String currentMonthStr,
            double currentElectricityExpense,
            double currentWaterExpense,
            double currentCombinedExpense,
            double electricityBudget,
            double waterBudget,
            double combinedBudget,
            double electricityPercentUsed,
            double waterPercentUsed,
            double combinedPercentUsed,
            List<ThresholdHit> hits
    ) {
    }

    /** Token-free sibling of getTriggeredAlertHits(token), for the scheduler to call directly with a resolved user. */
    public List<ThresholdHit> getTriggeredAlertHitsForUser(UserAccount user) {
        return computeStatus(user).hits;
    }

    private Double predictedMonthEnd(String token, UtilityType utilityType, double currentExpense, YearMonth currentMonth) {
        try {
            var prediction = predictionService.predictUpcomingBill(token, utilityType);
            if (prediction.hasEnoughData() && prediction.predictedAmount() != null) {
                return prediction.predictedAmount();
            }
        } catch (Exception ignored) {
            // fall through to naive proration
        }

        int dayOfMonth = java.time.LocalDate.now().getDayOfMonth();
        int daysInMonth = currentMonth.lengthOfMonth();
        if (dayOfMonth <= 1) {
            return currentExpense;
        }
        return currentExpense / dayOfMonth * daysInMonth;
    }

    /**
     * One triggered budget-threshold alert line. utilityKey is lowercase ("electricity"/"water"/
     * "combined") for use in RecommendationService's "budget:" + utility + ":threshold-" + N key
     * scheme; threshold is the single highest percentage crossed for that line.
     */
    public record ThresholdHit(String utilityKey, int threshold, String message) {
    }

    /** Structured version of getStatus()'s triggered alerts, for RecommendationService to key off of. */
    public List<ThresholdHit> getTriggeredAlertHits(String token) {
        UserAccount user = authService.requireUser(token);
        return getTriggeredAlertHitsForUser(user);
    }

    /** Only reports the single HIGHEST threshold crossed for a given line, not every one crossed. */
    private void addHighestThresholdHit(List<ThresholdHit> hits, String utilityKey, String label, double budgetAmount,
                                         double percentUsed, List<Integer> thresholds) {
        if (budgetAmount <= 0) {
            // A zero budget means "not tracking this" — never alert.
            return;
        }
        Integer highestCrossed = null;
        for (Integer threshold : thresholds) {
            if (threshold != null && percentUsed >= threshold) {
                if (highestCrossed == null || threshold > highestCrossed) {
                    highestCrossed = threshold;
                }
            }
        }
        if (highestCrossed != null) {
            String message = String.format(
                    "%s spending has reached %.0f%% of your ₹%.0f monthly budget.",
                    label, percentUsed, budgetAmount);
            hits.add(new ThresholdHit(utilityKey, highestCrossed, message));
        }
    }

    private double percentUsed(double current, double budgetAmount) {
        if (budgetAmount <= 0) return 0;
        return (current / budgetAmount) * 100.0;
    }

    private double nz(Double value) {
        return value == null ? 0 : value;
    }

    private double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}
