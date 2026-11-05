package com.ecotrack.backend.service;

import com.ecotrack.backend.dto.DashboardChartsResponse;
import com.ecotrack.backend.dto.DashboardSummaryResponse;
import com.ecotrack.backend.model.Bill;
import com.ecotrack.backend.model.UserAccount;
import com.ecotrack.backend.repository.BillRepository;
import org.springframework.stereotype.Service;

import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * In-memory aggregation of a user's bills for the dashboard. No Mongo aggregation pipelines —
 * per-user bill volumes are small enough that plain Java stream grouping is simpler and fine.
 */
@Service
public class DashboardService {

    private static final Set<String> UNPAID_STATUSES = Set.of("PENDING", "OVERDUE");

    private final BillRepository billRepository;
    private final AuthService authService;

    public DashboardService(BillRepository billRepository, AuthService authService) {
        this.billRepository = billRepository;
        this.authService = authService;
    }

    public DashboardSummaryResponse getSummary(String token) {
        UserAccount user = authService.requireUser(token);
        List<Bill> bills = billRepository.findByUserId(user.getId());

        if (bills.isEmpty()) {
            return new DashboardSummaryResponse(false, 0, 0, 0, 0, List.of(), List.of());
        }

        YearMonth cutoff = YearMonth.now().minusMonths(11);

        double totalElectricity = bills.stream()
                .filter(b -> "ELECTRICITY".equalsIgnoreCase(b.getUtilityType()))
                .filter(b -> isWithinLast12Months(b.getBillingMonth(), cutoff))
                .mapToDouble(b -> nz(b.getBillAmount()))
                .sum();
        double totalWater = bills.stream()
                .filter(b -> "WATER".equalsIgnoreCase(b.getUtilityType()))
                .filter(b -> isWithinLast12Months(b.getBillingMonth(), cutoff))
                .mapToDouble(b -> nz(b.getBillAmount()))
                .sum();

        List<Bill> unpaid = bills.stream()
                .filter(b -> b.getPaymentStatus() != null && UNPAID_STATUSES.contains(b.getPaymentStatus().toUpperCase()))
                .toList();
        int pendingCount = unpaid.size();
        double pendingTotal = unpaid.stream().mapToDouble(b -> nz(b.getBillAmount())).sum();

        List<DashboardSummaryResponse.UpcomingDue> upcoming = unpaid.stream()
                .filter(b -> b.getDueDate() != null && !b.getDueDate().isBlank())
                .sorted(Comparator.comparing(Bill::getDueDate))
                .limit(5)
                .map(b -> new DashboardSummaryResponse.UpcomingDue(b.getId(), b.getProvider(), b.getUtilityType(),
                        b.getBillAmount(), b.getDueDate()))
                .toList();

        List<DashboardSummaryResponse.RecentBill> recent = bills.stream()
                .sorted(Comparator.comparing(Bill::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(5)
                .map(b -> new DashboardSummaryResponse.RecentBill(b.getId(), b.getProvider(), b.getUtilityType(),
                        b.getBillingMonth(), b.getBillAmount(), b.getPaymentStatus()))
                .toList();

        return new DashboardSummaryResponse(true, round2(totalElectricity), round2(totalWater), pendingCount,
                round2(pendingTotal), upcoming, recent);
    }

    public DashboardChartsResponse getCharts(String token) {
        UserAccount user = authService.requireUser(token);
        List<Bill> bills = billRepository.findByUserId(user.getId());

        List<DashboardChartsResponse.MonthPoint> electricityByMonth = byMonth(bills, "ELECTRICITY");
        List<DashboardChartsResponse.MonthPoint> waterByMonth = byMonth(bills, "WATER");
        List<DashboardChartsResponse.MonthPoint> expensesByMonth = combinedByMonth(bills);

        double totalElectricity = bills.stream()
                .filter(b -> "ELECTRICITY".equalsIgnoreCase(b.getUtilityType()))
                .mapToDouble(b -> nz(b.getBillAmount()))
                .sum();
        double totalWater = bills.stream()
                .filter(b -> "WATER".equalsIgnoreCase(b.getUtilityType()))
                .mapToDouble(b -> nz(b.getBillAmount()))
                .sum();

        List<DashboardChartsResponse.YearPoint> yearlyTrends = yearlyTrends(bills);

        return new DashboardChartsResponse(electricityByMonth, waterByMonth, expensesByMonth,
                new DashboardChartsResponse.UtilityTotals(round2(totalElectricity), round2(totalWater)), yearlyTrends);
    }

    private List<DashboardChartsResponse.MonthPoint> byMonth(List<Bill> bills, String utilityType) {
        Map<String, double[]> grouped = new LinkedHashMap<>(); // month -> [units, amount]
        bills.stream()
                .filter(b -> utilityType.equalsIgnoreCase(b.getUtilityType()))
                .filter(b -> isValidMonth(b.getBillingMonth()))
                .sorted(Comparator.comparing(b -> YearMonth.parse(b.getBillingMonth())))
                .forEach(b -> grouped.merge(b.getBillingMonth(),
                        new double[]{nz(b.getUnitsConsumed()), nz(b.getBillAmount())},
                        (a, c) -> new double[]{a[0] + c[0], a[1] + c[1]}));

        return capToRecent(grouped.entrySet().stream()
                .map(e -> new DashboardChartsResponse.MonthPoint(e.getKey(), round2(e.getValue()[0]), round2(e.getValue()[1])))
                .toList());
    }

    private List<DashboardChartsResponse.MonthPoint> combinedByMonth(List<Bill> bills) {
        Map<String, double[]> grouped = new LinkedHashMap<>(); // month -> [units, amount]
        bills.stream()
                .filter(b -> isValidMonth(b.getBillingMonth()))
                .sorted(Comparator.comparing(b -> YearMonth.parse(b.getBillingMonth())))
                .forEach(b -> grouped.merge(b.getBillingMonth(),
                        new double[]{nz(b.getUnitsConsumed()), nz(b.getBillAmount())},
                        (a, c) -> new double[]{a[0] + c[0], a[1] + c[1]}));

        return capToRecent(grouped.entrySet().stream()
                .map(e -> new DashboardChartsResponse.MonthPoint(e.getKey(), round2(e.getValue()[0]), round2(e.getValue()[1])))
                .toList());
    }

    private List<DashboardChartsResponse.YearPoint> yearlyTrends(List<Bill> bills) {
        Map<String, double[]> grouped = new LinkedHashMap<>(); // year -> [units, amount]
        bills.stream()
                .filter(b -> isValidMonth(b.getBillingMonth()))
                .sorted(Comparator.comparing(b -> YearMonth.parse(b.getBillingMonth())))
                .forEach(b -> {
                    String year = b.getBillingMonth().substring(0, 4);
                    grouped.merge(year, new double[]{nz(b.getUnitsConsumed()), nz(b.getBillAmount())},
                            (a, c) -> new double[]{a[0] + c[0], a[1] + c[1]});
                });

        return grouped.entrySet().stream()
                .map(e -> new DashboardChartsResponse.YearPoint(e.getKey(), round2(e.getValue()[0]), round2(e.getValue()[1])))
                .toList();
    }

    /** Caps to the most recent 18 months for sanity, per spec. */
    private List<DashboardChartsResponse.MonthPoint> capToRecent(List<DashboardChartsResponse.MonthPoint> points) {
        if (points.size() <= 18) return points;
        return points.subList(points.size() - 18, points.size());
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

    private boolean isWithinLast12Months(String billingMonth, YearMonth cutoff) {
        if (!isValidMonth(billingMonth)) return false;
        return !YearMonth.parse(billingMonth).isBefore(cutoff);
    }

    private double nz(Double value) {
        return value == null ? 0 : value;
    }

    private double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}
