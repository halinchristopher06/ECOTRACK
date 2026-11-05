package com.ecotrack.backend.service;

import com.ecotrack.backend.dto.AnomalyCheckResponse;
import com.ecotrack.backend.model.Bill;
import com.ecotrack.backend.model.NotificationPreference;
import com.ecotrack.backend.model.UserAccount;
import com.ecotrack.backend.repository.BillRepository;
import com.ecotrack.backend.repository.UserRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Scheduled jobs for the Bill Due Dates and Notifications module. Lives in the service package
 * (rather than a top-level "scheduler" package) so it can call BillService's package-private
 * markOverdueBySystem(Bill) system-job method directly.
 *
 * Cron expressions use the server's default timezone (no explicit zone configured, matching the
 * rest of this project's simple approach):
 *  - checkDueDatesAndOverdue / checkBillUploadReminders / checkBudgetAndAnomalyAlerts: daily at 08:00
 *  - sendMonthlySummaries: 09:00 on the 1st of each month
 */
@Component
public class NotificationScheduler {

    private final BillRepository billRepository;
    private final UserRepository userRepository;
    private final BillService billService;
    private final NotificationService notificationService;
    private final BudgetService budgetService;
    private final AnomalyDetectionService anomalyDetectionService;

    public NotificationScheduler(
            BillRepository billRepository,
            UserRepository userRepository,
            BillService billService,
            NotificationService notificationService,
            BudgetService budgetService,
            AnomalyDetectionService anomalyDetectionService
    ) {
        this.billRepository = billRepository;
        this.userRepository = userRepository;
        this.billService = billService;
        this.notificationService = notificationService;
        this.budgetService = budgetService;
        this.anomalyDetectionService = anomalyDetectionService;
    }

    /** Daily at 8 AM: payment reminders (3 and 1 days before due) + overdue detection. */
    @Scheduled(cron = "0 0 8 * * *")
    public void checkDueDatesAndOverdue() {
        List<Bill> pendingBills = billRepository.findAll().stream()
                .filter(b -> "PENDING".equalsIgnoreCase(b.getPaymentStatus()))
                .toList();

        LocalDate today = LocalDate.now();
        for (Bill bill : pendingBills) {
            try {
                if (bill.getDueDate() == null || bill.getDueDate().isBlank()) {
                    continue;
                }
                LocalDate dueDate = LocalDate.parse(bill.getDueDate());
                long daysDiff = java.time.temporal.ChronoUnit.DAYS.between(today, dueDate);

                if (daysDiff == 3 || daysDiff == 1) {
                    NotificationPreference prefs = notificationService.getOrCreateDefaultPreferences(bill.getUserId());
                    notificationService.createIfNew(
                            bill.getUserId(),
                            "PAYMENT_REMINDER",
                            "payment-reminder:" + bill.getId() + ":" + daysDiff,
                            "Upcoming payment due",
                            "Your " + bill.getProvider() + " bill of ₹" + bill.getBillAmount() + " is due in " + daysDiff + " day(s).",
                            prefs.isPaymentRemindersEnabled()
                    );
                } else if (daysDiff < 0) {
                    billService.markOverdueBySystem(bill);
                    NotificationPreference prefs = notificationService.getOrCreateDefaultPreferences(bill.getUserId());
                    notificationService.createIfNew(
                            bill.getUserId(),
                            "OVERDUE",
                            "overdue:" + bill.getId(),
                            "Bill overdue",
                            "Your " + bill.getProvider() + " bill of ₹" + bill.getBillAmount() + " was due on " + bill.getDueDate() + " and is now overdue.",
                            prefs.isOverdueAlertsEnabled()
                    );
                }
            } catch (Exception e) {
                System.err.println("Warning: checkDueDatesAndOverdue failed for bill " + bill.getId() + ": " + e.getMessage());
            }
        }
    }

    /** Same daily 8 AM run: nudge users who haven't logged a bill for the current month once the month is almost over. */
    @Scheduled(cron = "0 0 8 * * *")
    public void checkBillUploadReminders() {
        LocalDate today = LocalDate.now();
        if (today.getDayOfMonth() < 25) {
            return;
        }
        String currentYyyyMm = YearMonth.now().toString();

        List<Bill> allBills = billRepository.findAll();
        Set<String> userIdsWithAnyBill = new HashSet<>();
        for (Bill b : allBills) {
            if (b.getUserId() != null) userIdsWithAnyBill.add(b.getUserId());
        }

        for (String userId : userIdsWithAnyBill) {
            try {
                boolean hasCurrentMonthBill = allBills.stream()
                        .anyMatch(b -> userId.equals(b.getUserId()) && currentYyyyMm.equals(b.getBillingMonth()));
                if (hasCurrentMonthBill) {
                    continue;
                }
                NotificationPreference prefs = notificationService.getOrCreateDefaultPreferences(userId);
                notificationService.createIfNew(
                        userId,
                        "BILL_UPLOAD_REMINDER",
                        "bill-upload-reminder:" + userId + ":" + currentYyyyMm,
                        "Log this month's bill",
                        "This month is almost over and you haven't logged a bill for " + currentYyyyMm + " yet. Add it to keep your tracking up to date.",
                        prefs.isBillUploadRemindersEnabled()
                );
            } catch (Exception e) {
                System.err.println("Warning: checkBillUploadReminders failed for user " + userId + ": " + e.getMessage());
            }
        }
    }

    /** Same daily 8 AM run: budget-threshold and unusual-consumption alerts. */
    @Scheduled(cron = "0 0 8 * * *")
    public void checkBudgetAndAnomalyAlerts() {
        String currentYyyyMm = YearMonth.now().toString();
        List<UserAccount> users = userRepository.findAll();

        for (UserAccount user : users) {
            try {
                NotificationPreference prefs = notificationService.getOrCreateDefaultPreferences(user.getId());

                for (BudgetService.ThresholdHit hit : budgetService.getTriggeredAlertHitsForUser(user)) {
                    notificationService.createIfNew(
                            user.getId(),
                            "BUDGET_ALERT",
                            "budget:" + user.getId() + ":" + hit.utilityKey() + ":threshold-" + hit.threshold() + ":" + currentYyyyMm,
                            "Budget alert",
                            hit.message(),
                            prefs.isBudgetAlertsEnabled()
                    );
                }

                for (String utilityType : List.of("ELECTRICITY", "WATER")) {
                    AnomalyCheckResponse anomaly = anomalyDetectionService.checkUnusualConsumptionForUser(user, utilityType);
                    if (anomaly.isUnusual()) {
                        notificationService.createIfNew(
                                user.getId(),
                                "ANOMALY_ALERT",
                                "anomaly:" + user.getId() + ":" + utilityType + ":" + currentYyyyMm,
                                "Unusual consumption detected",
                                anomaly.message(),
                                prefs.isAnomalyAlertsEnabled()
                        );
                    }
                }
            } catch (Exception e) {
                System.err.println("Warning: checkBudgetAndAnomalyAlerts failed for user " + user.getId() + ": " + e.getMessage());
            }
        }
    }

    /** Monthly, 9 AM on the 1st: summary of last month's spend per user. */
    @Scheduled(cron = "0 0 9 1 * *")
    public void sendMonthlySummaries() {
        YearMonth lastMonth = YearMonth.now().minusMonths(1);
        String lastYyyyMm = lastMonth.toString();
        String lastMonthLabel = lastMonth.getMonth().getDisplayName(java.time.format.TextStyle.FULL, Locale.ENGLISH) + " " + lastMonth.getYear();

        List<Bill> allBills = billRepository.findAll();
        Set<String> userIdsWithAnyBill = new HashSet<>();
        for (Bill b : allBills) {
            if (b.getUserId() != null) userIdsWithAnyBill.add(b.getUserId());
        }

        for (String userId : userIdsWithAnyBill) {
            try {
                List<Bill> lastMonthBills = allBills.stream()
                        .filter(b -> userId.equals(b.getUserId()) && lastYyyyMm.equals(b.getBillingMonth()))
                        .toList();
                if (lastMonthBills.isEmpty()) {
                    continue;
                }

                double electricityTotal = lastMonthBills.stream()
                        .filter(b -> "ELECTRICITY".equalsIgnoreCase(b.getUtilityType()))
                        .mapToDouble(b -> b.getBillAmount() == null ? 0 : b.getBillAmount())
                        .sum();
                double waterTotal = lastMonthBills.stream()
                        .filter(b -> "WATER".equalsIgnoreCase(b.getUtilityType()))
                        .mapToDouble(b -> b.getBillAmount() == null ? 0 : b.getBillAmount())
                        .sum();

                String message = String.format(
                        "Your EcoTrack summary for %s: electricity ₹%.2f, water ₹%.2f, across %d bill(s).",
                        lastMonthLabel, electricityTotal, waterTotal, lastMonthBills.size());

                NotificationPreference prefs = notificationService.getOrCreateDefaultPreferences(userId);
                notificationService.createIfNew(
                        userId,
                        "MONTHLY_SUMMARY",
                        "monthly-summary:" + userId + ":" + lastYyyyMm,
                        "Your EcoTrack summary for " + lastMonthLabel,
                        message,
                        prefs.isMonthlySummaryEnabled()
                );
            } catch (Exception e) {
                System.err.println("Warning: sendMonthlySummaries failed for user " + userId + ": " + e.getMessage());
            }
        }
    }
}
