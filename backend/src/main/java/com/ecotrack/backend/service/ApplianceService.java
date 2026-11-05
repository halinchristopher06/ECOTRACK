package com.ecotrack.backend.service;

import com.ecotrack.backend.dto.ApplianceBreakdownResponse;
import com.ecotrack.backend.dto.ApplianceCostBreakdown;
import com.ecotrack.backend.dto.CreateApplianceRequest;
import com.ecotrack.backend.dto.UpdateApplianceRequest;
import com.ecotrack.backend.exception.ApiException;
import com.ecotrack.backend.model.Appliance;
import com.ecotrack.backend.model.TariffConfig;
import com.ecotrack.backend.model.UserAccount;
import com.ecotrack.backend.model.UserRole;
import com.ecotrack.backend.repository.ApplianceRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
public class ApplianceService {

    // Catalog ids (from frontend/src/appliancesCatalog.js) considered "known high-wattage
    // categories" for the rule-based tips below.
    private static final Set<String> HIGH_WATTAGE_CATALOG_IDS = Set.of(
            "ac1", "ac15", "geyser", "iron", "kettle", "induction", "microwave"
    );

    private final ApplianceRepository applianceRepository;
    private final AuthService authService;
    private final TariffAdminService tariffAdminService;

    public ApplianceService(
            ApplianceRepository applianceRepository,
            AuthService authService,
            TariffAdminService tariffAdminService
    ) {
        this.applianceRepository = applianceRepository;
        this.authService = authService;
        this.tariffAdminService = tariffAdminService;
    }

    public Appliance create(String token, CreateApplianceRequest request) {
        UserAccount user = authService.requireUser(token);
        validate(request.name(), request.wattage(), request.quantity(), request.hoursPerDay());

        Appliance appliance = new Appliance();
        appliance.setId(UUID.randomUUID().toString());
        appliance.setUserId(user.getId());
        appliance.setName(request.name().trim());
        appliance.setCatalogId(request.catalogId());
        appliance.setQuantity(request.quantity() != null ? request.quantity() : 1);
        appliance.setWattage(request.wattage());
        appliance.setHoursPerDay(request.hoursPerDay());
        appliance.setDaysPerMonth(request.daysPerMonth() != null ? request.daysPerMonth() : 30);
        Instant now = Instant.now();
        appliance.setCreatedAt(now);
        appliance.setUpdatedAt(now);
        return applianceRepository.save(appliance);
    }

    public List<Appliance> list(String token) {
        UserAccount user = authService.requireUser(token);
        return applianceRepository.findByUserId(user.getId()).stream()
                .sorted(Comparator.comparing(Appliance::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
    }

    public Appliance get(String token, String id) {
        return requireOwnedAppliance(token, id);
    }

    public Appliance update(String token, String id, UpdateApplianceRequest request) {
        Appliance appliance = requireOwnedAppliance(token, id);
        if (request.name() != null) appliance.setName(request.name().trim());
        if (request.catalogId() != null) appliance.setCatalogId(request.catalogId());
        if (request.quantity() != null) appliance.setQuantity(request.quantity());
        if (request.wattage() != null) appliance.setWattage(request.wattage());
        if (request.hoursPerDay() != null) appliance.setHoursPerDay(request.hoursPerDay());
        if (request.daysPerMonth() != null) appliance.setDaysPerMonth(request.daysPerMonth());
        appliance.setUpdatedAt(Instant.now());
        return applianceRepository.save(appliance);
    }

    public void delete(String token, String id) {
        Appliance appliance = requireOwnedAppliance(token, id);
        applianceRepository.deleteById(appliance.getId());
    }

    /**
     * Computes the per-appliance cost breakdown for a single appliance.
     *
     * Appliance-level attribution uses the tariff's base per-unit rate (the first slab's rate)
     * rather than the full household slab curve, since an individual appliance's consumption
     * can't be meaningfully assigned a position within the household's overall slab — this
     * matches how the OLD estimator (BillingService.estimateAppliances) already worked, for
     * consistency.
     */
    public ApplianceCostBreakdown computeCosts(Appliance appliance, TariffConfig electricityTariff) {
        double rate = electricityTariff.getSlabs().get(0).rate();

        double dailyEnergyKwh = (appliance.getWattage() * appliance.getQuantity() * appliance.getHoursPerDay()) / 1000.0;
        double dailyCost = dailyEnergyKwh * rate;
        double daysPerMonth = appliance.getDaysPerMonth() > 0 ? appliance.getDaysPerMonth() : 30;
        double monthlyEnergyKwh = dailyEnergyKwh * daysPerMonth;
        double monthlyCost = dailyCost * daysPerMonth;
        double annualCost = monthlyCost * 12;

        return new ApplianceCostBreakdown(
                appliance.getId(),
                appliance.getName(),
                appliance.getCatalogId(),
                appliance.getQuantity(),
                appliance.getWattage(),
                appliance.getHoursPerDay(),
                daysPerMonth,
                TariffCalculator.round2(dailyEnergyKwh),
                TariffCalculator.round2(dailyCost),
                TariffCalculator.round2(monthlyEnergyKwh),
                TariffCalculator.round2(monthlyCost),
                TariffCalculator.round2(annualCost),
                false
        );
    }

    public ApplianceBreakdownResponse getBreakdown(String token) {
        UserAccount user = authService.requireUser(token);
        List<Appliance> appliances = applianceRepository.findByUserId(user.getId());

        if (appliances.isEmpty()) {
            return new ApplianceBreakdownResponse(List.of(), 0, 0, List.of(), true);
        }

        TariffConfig electricityTariff = tariffAdminService.getDefaultElectricityTariff();

        List<ApplianceCostBreakdown> breakdowns = appliances.stream()
                .map(a -> computeCosts(a, electricityTariff))
                .sorted(Comparator.comparing(ApplianceCostBreakdown::monthlyCost).reversed())
                .toList();

        double totalMonthlyCost = TariffCalculator.round2(
                breakdowns.stream().mapToDouble(ApplianceCostBreakdown::monthlyCost).sum());
        double totalAnnualCost = TariffCalculator.round2(
                breakdowns.stream().mapToDouble(ApplianceCostBreakdown::annualCost).sum());

        // Mark the highest-cost appliance (first after sorting descending by monthlyCost).
        List<ApplianceCostBreakdown> ranked = new ArrayList<>(breakdowns.size());
        for (int i = 0; i < breakdowns.size(); i++) {
            ApplianceCostBreakdown b = breakdowns.get(i);
            ranked.add(i == 0
                    ? new ApplianceCostBreakdown(b.id(), b.name(), b.catalogId(), b.quantity(), b.wattage(),
                            b.hoursPerDay(), b.daysPerMonth(), b.dailyEnergyKwh(), b.dailyCost(),
                            b.monthlyEnergyKwh(), b.monthlyCost(), b.annualCost(), true)
                    : b);
        }

        List<Tip> tips = buildRecommendationTips(ranked, totalMonthlyCost);
        List<String> recommendations = tips.stream().map(Tip::text).toList();

        return new ApplianceBreakdownResponse(ranked, totalMonthlyCost, totalAnnualCost, recommendations, false);
    }

    /**
     * A stable (key, text) pair for a single generated recommendation tip. The key lets
     * RecommendationService recognize "the same underlying tip" across repeated generations even
     * as its wording (e.g. percentages) changes slightly — see RecommendationService for the full
     * key-scheme documentation.
     */
    public record Tip(String key, String text) {
    }

    /**
     * Rule-based appliance tips, now also used by RecommendationService to persist/mirror these
     * into the cross-source Recommendation collection. Package-visible so RecommendationService
     * can call it directly; getBreakdown() above still exposes only the bare text strings so the
     * /api/appliances/breakdown response shape is unchanged for existing consumers.
     */
    List<Tip> buildRecommendationTips(String token) {
        UserAccount user = authService.requireUser(token);
        List<Appliance> appliances = applianceRepository.findByUserId(user.getId());
        if (appliances.isEmpty()) {
            return List.of();
        }

        TariffConfig electricityTariff = tariffAdminService.getDefaultElectricityTariff();
        List<ApplianceCostBreakdown> breakdowns = appliances.stream()
                .map(a -> computeCosts(a, electricityTariff))
                .sorted(Comparator.comparing(ApplianceCostBreakdown::monthlyCost).reversed())
                .toList();
        double totalMonthlyCost = TariffCalculator.round2(
                breakdowns.stream().mapToDouble(ApplianceCostBreakdown::monthlyCost).sum());

        return buildRecommendationTips(breakdowns, totalMonthlyCost);
    }

    /**
     * Small, rule-based set of helpful tips — explicitly NOT a real ML recommender, just simple
     * if/else heuristics, consistent with the project's "rule-based (initially)" approach used
     * elsewhere (e.g. anomaly detection).
     *
     * Key scheme: "appliance:" + applianceId + ":" + tipKind, where tipKind is one of
     * "top-share", "high-hours", or "high-wattage-category" — stable across regeneration even
     * though the tip text itself (percentages, hours) may change.
     */
    private List<Tip> buildRecommendationTips(List<ApplianceCostBreakdown> ranked, double totalMonthlyCost) {
        List<Tip> tips = new ArrayList<>();
        if (ranked.isEmpty() || totalMonthlyCost <= 0) {
            return tips;
        }

        ApplianceCostBreakdown top = ranked.get(0);
        double sharePercent = (top.monthlyCost() / totalMonthlyCost) * 100.0;
        if (sharePercent > 30) {
            tips.add(new Tip(
                    "appliance:" + top.id() + ":top-share",
                    String.format(
                            "%s accounts for %.0f%% of your appliance costs — consider reducing usage or checking for a more efficient model.",
                            top.name(), sharePercent)));
        }

        for (ApplianceCostBreakdown item : ranked) {
            if (item.hoursPerDay() > 12) {
                tips.add(new Tip(
                        "appliance:" + item.id() + ":high-hours",
                        String.format(
                                "%s runs for %.1f hours/day — reducing its daily runtime could meaningfully lower your bill.",
                                item.name(), item.hoursPerDay())));
            }

            if (item.catalogId() != null && HIGH_WATTAGE_CATALOG_IDS.contains(item.catalogId()) && item.hoursPerDay() > 4) {
                tips.add(new Tip(
                        "appliance:" + item.id() + ":high-wattage-category",
                        specificTipFor(item.catalogId(), item.name())));
            }
        }

        return tips;
    }

    private String specificTipFor(String catalogId, String name) {
        return switch (catalogId) {
            case "ac1", "ac15" -> "Raising " + name + "'s thermostat by 1°C can cut cooling costs by roughly 6%.";
            case "geyser" -> "Using a timer or reducing " + name + "'s runtime by even 30 minutes/day can meaningfully lower your bill.";
            case "iron" -> "Batching your ironing into fewer, longer sessions reduces " + name + "'s standby reheating cost.";
            case "kettle" -> "Boiling only the water you need reduces " + name + "'s energy use per use.";
            case "induction" -> "Using the right-sized cookware improves " + name + "'s heating efficiency and cuts run time.";
            case "microwave" -> "Covering food while reheating in " + name + " shortens cook time and saves energy.";
            default -> name + " is a high-wattage appliance with significant daily usage — consider reducing its runtime.";
        };
    }

    private Appliance requireOwnedAppliance(String token, String id) {
        UserAccount user = authService.requireUser(token);
        Appliance appliance = applianceRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Appliance not found."));
        boolean owns = appliance.getUserId() != null && appliance.getUserId().equals(user.getId());
        boolean isAdmin = user.getRole() == UserRole.ADMIN;
        if (!owns && !isAdmin) {
            throw new ApiException(HttpStatus.FORBIDDEN, "You do not have access to this appliance.");
        }
        return appliance;
    }

    private void validate(String name, Double wattage, Integer quantity, Double hoursPerDay) {
        if (name == null || name.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "name is required.");
        }
        if (wattage == null || wattage <= 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "wattage must be a positive number.");
        }
        if (quantity != null && quantity <= 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "quantity must be a positive number.");
        }
        if (hoursPerDay == null || hoursPerDay < 0 || hoursPerDay > 24) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "hoursPerDay must be between 0 and 24.");
        }
    }
}
