package com.ecotrack.backend.service;

import com.ecotrack.backend.dto.BillPredictionResponse;
import com.ecotrack.backend.model.Bill;
import com.ecotrack.backend.model.TariffConfig;
import com.ecotrack.backend.model.UserAccount;
import com.ecotrack.backend.model.UtilityType;
import com.ecotrack.backend.repository.BillRepository;
import org.springframework.stereotype.Service;

import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.Comparator;
import java.util.List;

/**
 * Forecasts the user's next upcoming utility bill from their own bill history, using a simple
 * recency-weighted blend rather than any heavyweight statistical model — this is meant to be a
 * helpful estimate ("roughly what to expect"), not an official prediction.
 */
@Service
public class PredictionService {

    private final BillRepository billRepository;
    private final AuthService authService;
    private final TariffAdminService tariffAdminService;

    public PredictionService(BillRepository billRepository, AuthService authService,
                              TariffAdminService tariffAdminService) {
        this.billRepository = billRepository;
        this.authService = authService;
        this.tariffAdminService = tariffAdminService;
    }

    public BillPredictionResponse predictUpcomingBill(String token, UtilityType utilityType) {
        UserAccount user = authService.requireUser(token);
        List<Bill> bills = billRepository.findByUserId(user.getId()).stream()
                .filter(b -> utilityType.name().equalsIgnoreCase(b.getUtilityType()))
                .filter(b -> parseMonth(b.getBillingMonth()) != null)
                .sorted(Comparator.comparing(b -> parseMonth(b.getBillingMonth())))
                .toList();

        if (bills.isEmpty()) {
            return new BillPredictionResponse(false, "NONE", null, null, null, null, null, null,
                    "Add at least 2 bills to get a prediction.");
        }

        TariffConfig tariff = utilityType == UtilityType.ELECTRICITY
                ? tariffAdminService.getDefaultElectricityTariff()
                : tariffAdminService.getDefaultWaterTariff();

        Bill mostRecent = bills.get(bills.size() - 1);
        double previousBillAmount = mostRecent.getBillAmount() == null ? 0 : mostRecent.getBillAmount();

        if (bills.size() == 1) {
            double predictedUnits = mostRecent.getUnitsConsumed() == null ? 0 : mostRecent.getUnitsConsumed();
            double predictedAmount = mostRecent.getBillAmount() != null
                    ? mostRecent.getBillAmount()
                    : TariffCalculator.calculateBillAmount(predictedUnits, tariff);
            double[] range = amountRange(predictedAmount);
            return new BillPredictionResponse(true, "LOW", TariffCalculator.round2(predictedUnits),
                    TariffCalculator.round2(predictedAmount), TariffCalculator.round2(range[0]),
                    TariffCalculator.round2(range[1]), TariffCalculator.round2(previousBillAmount), null,
                    "Only one bill on record — this is your best available guess. Add more bills to improve accuracy.");
        }

        double predictedUnits = weightedPredictedUnits(bills, mostRecent);
        double predictedAmount = TariffCalculator.calculateBillAmount(predictedUnits, tariff);
        double[] range = amountRange(predictedAmount);
        String confidence = bills.size() >= 6 ? "HIGH" : "MEDIUM";

        BillPredictionResponse.ActualVsPredicted comparison = buildCurrentMonthComparison(bills, tariff);

        String message = "Prediction based on your last " + Math.min(bills.size(), 3)
                + " bill(s)" + (hasYearAgoSample(bills, mostRecent) ? ", with a seasonal adjustment from last year." : ".");

        return new BillPredictionResponse(true, confidence, TariffCalculator.round2(predictedUnits),
                TariffCalculator.round2(predictedAmount), TariffCalculator.round2(range[0]),
                TariffCalculator.round2(range[1]), TariffCalculator.round2(previousBillAmount), comparison, message);
    }

    /** Weighted blend of the last up-to-3 bills, most-recent weighted heaviest, plus an optional seasonal nudge. */
    private double weightedPredictedUnits(List<Bill> billsAscending, Bill mostRecent) {
        List<Bill> recentDesc = billsAscending.stream()
                .sorted(Comparator.comparing((Bill b) -> parseMonth(b.getBillingMonth())).reversed())
                .limit(3)
                .toList();

        double[] baseWeights = {0.5, 0.3, 0.2};
        double weightSum = 0;
        double weighted = 0;
        for (int i = 0; i < recentDesc.size(); i++) {
            double units = recentDesc.get(i).getUnitsConsumed() == null ? 0 : recentDesc.get(i).getUnitsConsumed();
            weighted += units * baseWeights[i];
            weightSum += baseWeights[i];
        }
        double trendPrediction = weightSum > 0 ? weighted / weightSum : 0;

        // Seasonal blend: only applied when sufficient history exists, per spec — avoid false
        // seasonal assumptions without enough data. Requires 12+ months of history and an actual
        // bill from the same calendar month a year ago.
        if (hasYearAgoSample(billsAscending, mostRecent)) {
            Bill yearAgo = findYearAgoSample(billsAscending, mostRecent);
            double yearAgoUnits = yearAgo.getUnitsConsumed() == null ? 0 : yearAgo.getUnitsConsumed();
            return trendPrediction * 0.8 + yearAgoUnits * 0.2;
        }
        return trendPrediction;
    }

    private boolean hasYearAgoSample(List<Bill> billsAscending, Bill mostRecent) {
        return spansAtLeast12Months(billsAscending) && findYearAgoSample(billsAscending, mostRecent) != null;
    }

    private boolean spansAtLeast12Months(List<Bill> billsAscending) {
        YearMonth earliest = parseMonth(billsAscending.get(0).getBillingMonth());
        YearMonth latest = parseMonth(billsAscending.get(billsAscending.size() - 1).getBillingMonth());
        if (earliest == null || latest == null) return false;
        return earliest.until(latest, java.time.temporal.ChronoUnit.MONTHS) >= 12;
    }

    private Bill findYearAgoSample(List<Bill> billsAscending, Bill mostRecent) {
        YearMonth target = parseMonth(mostRecent.getBillingMonth());
        if (target == null) return null;
        YearMonth yearAgo = target.minusYears(1);
        return billsAscending.stream()
                .filter(b -> yearAgo.equals(parseMonth(b.getBillingMonth())))
                .findFirst()
                .orElse(null);
    }

    /**
     * Simple nice-to-have: compares this month's actual bill (if present) against a retrospective
     * trend prediction computed from the months before it. Kept intentionally simple.
     */
    private BillPredictionResponse.ActualVsPredicted buildCurrentMonthComparison(List<Bill> billsAscending, TariffConfig tariff) {
        String currentMonth = YearMonth.now().toString();
        Bill currentBill = billsAscending.stream()
                .filter(b -> currentMonth.equals(b.getBillingMonth()))
                .findFirst()
                .orElse(null);
        if (currentBill == null || currentBill.getBillAmount() == null) {
            return null;
        }

        List<Bill> priorMonths = billsAscending.stream()
                .filter(b -> !currentMonth.equals(b.getBillingMonth()))
                .toList();
        if (priorMonths.size() < 2) {
            return null;
        }

        Bill priorMostRecent = priorMonths.get(priorMonths.size() - 1);
        double retroUnits = weightedPredictedUnits(priorMonths, priorMostRecent);
        double retroAmount = TariffCalculator.calculateBillAmount(retroUnits, tariff);

        return new BillPredictionResponse.ActualVsPredicted(currentMonth,
                TariffCalculator.round2(currentBill.getBillAmount()), TariffCalculator.round2(retroAmount));
    }

    /** +-10% uncertainty band — a simple heuristic, not a statistical confidence interval. */
    private double[] amountRange(double predictedAmount) {
        return new double[]{predictedAmount * 0.9, predictedAmount * 1.1};
    }

    private YearMonth parseMonth(String billingMonth) {
        if (billingMonth == null || billingMonth.isBlank()) return null;
        try {
            return YearMonth.parse(billingMonth);
        } catch (DateTimeParseException e) {
            return null;
        }
    }
}
