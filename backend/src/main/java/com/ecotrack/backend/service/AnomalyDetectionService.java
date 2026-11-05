package com.ecotrack.backend.service;

import com.ecotrack.backend.dto.AnomalyCheckResponse;
import com.ecotrack.backend.model.Bill;
import com.ecotrack.backend.model.UserAccount;
import com.ecotrack.backend.repository.BillRepository;
import org.springframework.stereotype.Service;

import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.Comparator;
import java.util.List;

/**
 * Rule-based unusual-consumption detection — explicitly NOT a statistical model, matching the
 * project's "rule-based initially" approach used elsewhere (e.g. ApplianceService's tips).
 */
@Service
public class AnomalyDetectionService {

    /** A simple rule-of-thumb threshold, not a statistically derived one. */
    private static final double UNUSUAL_PERCENT_THRESHOLD = 25.0;

    /** Require at least this many PRIOR bills (so 4+ total) before running detection at all. */
    private static final int MIN_PRIOR_BILLS = 3;

    private static final List<String> POSSIBLE_CAUSES = List.of(
            "Increased appliance usage or longer running hours",
            "More occupants or guests during this period",
            "Seasonal weather change (e.g. more AC/heater use)",
            "A possible appliance fault or meter irregularity"
    );

    private static final List<String> RECOMMENDED_ACTIONS = List.of(
            "Review your Appliance Tracker to see which device may be running longer than usual",
            "Check for any new or malfunctioning appliances",
            "Compare this month's readings against your meter for accuracy",
            "Consider a quick energy audit of high-wattage appliances"
    );

    private final BillRepository billRepository;
    private final AuthService authService;

    public AnomalyDetectionService(BillRepository billRepository, AuthService authService) {
        this.billRepository = billRepository;
        this.authService = authService;
    }

    public AnomalyCheckResponse checkUnusualConsumption(String token, String utilityType) {
        UserAccount user = authService.requireUser(token);
        return checkUnusualConsumptionForUser(user, utilityType);
    }

    /** Token-free sibling, for the scheduler to call directly with a resolved user. */
    public AnomalyCheckResponse checkUnusualConsumptionForUser(UserAccount user, String utilityType) {
        List<Bill> bills = billRepository.findByUserId(user.getId()).stream()
                .filter(b -> utilityType.equalsIgnoreCase(b.getUtilityType()))
                .filter(b -> isValidMonth(b.getBillingMonth()))
                .sorted(Comparator.comparing(b -> YearMonth.parse(b.getBillingMonth())))
                .toList();

        if (bills.size() < MIN_PRIOR_BILLS + 1) {
            return new AnomalyCheckResponse(false, false, null, null, null, List.of(), List.of(),
                    "Add at least 4 billing records to enable unusual-consumption detection.");
        }

        Bill mostRecent = bills.get(bills.size() - 1);
        List<Bill> priorBills = bills.subList(0, bills.size() - 1);

        double historicalAverage = priorBills.stream().mapToDouble(b -> nz(b.getUnitsConsumed())).average().orElse(0);
        double currentConsumption = nz(mostRecent.getUnitsConsumed());
        double percentIncrease = historicalAverage == 0 ? 0 : (currentConsumption - historicalAverage) / historicalAverage * 100.0;

        boolean isUnusual = percentIncrease > UNUSUAL_PERCENT_THRESHOLD;

        String message = isUnusual
                ? String.format("This billing period's consumption is %.0f%% higher than your historical average — that's unusual.", percentIncrease)
                : "Your consumption looks consistent with your historical average.";

        return new AnomalyCheckResponse(
                true,
                isUnusual,
                round2(currentConsumption),
                round2(historicalAverage),
                round2(percentIncrease),
                isUnusual ? POSSIBLE_CAUSES : List.of(),
                isUnusual ? RECOMMENDED_ACTIONS : List.of(),
                message
        );
    }

    private boolean isValidMonth(String billingMonth) {
        if (billingMonth == null || billingMonth.isBlank()) return false;
        try {
            YearMonth.parse(billingMonth);
            return true;
        } catch (DateTimeParseException e) {
            return false;
        }
    }

    private double nz(Double value) {
        return value == null ? 0 : value;
    }

    private double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}
