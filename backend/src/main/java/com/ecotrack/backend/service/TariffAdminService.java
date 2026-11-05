package com.ecotrack.backend.service;

import com.ecotrack.backend.dto.CreateTariffRequest;
import com.ecotrack.backend.dto.TariffCatalogResponse;
import com.ecotrack.backend.exception.ApiException;
import com.ecotrack.backend.model.TariffConfig;
import com.ecotrack.backend.model.TariffPlan;
import com.ecotrack.backend.model.TariffSlab;
import com.ecotrack.backend.model.UserAccount;
import com.ecotrack.backend.model.UtilityType;
import com.ecotrack.backend.repository.TariffRepository;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
public class TariffAdminService {

    private final TariffRepository tariffRepository;
    private final AuthService authService;

    public TariffAdminService(TariffRepository tariffRepository, AuthService authService) {
        this.tariffRepository = tariffRepository;
        this.authService = authService;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onStartup() {
        try {
            if (tariffRepository.count() > 0) {
                return;
            }
            String today = LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE);
            List<TariffConfig> seed = new ArrayList<>();

            seed.add(seedRow(UtilityType.ELECTRICITY, "Adani Electricity Mumbai Ltd.", "Residential (LT)", "₹/kWh",
                    "Energy charge slabs indicative; FAC, wheeling, taxes extra.",
                    List.of(new TariffSlab(100.0, 3.65), new TariffSlab(300.0, 5.49),
                            new TariffSlab(500.0, 7.02), new TariffSlab(null, 8.52)), today));

            seed.add(seedRow(UtilityType.ELECTRICITY, "Tata Power Mumbai Distribution", "Residential (LT)", "₹/kWh",
                    "Slab-wise energy charges; regulatory charges as per MERC orders.",
                    List.of(new TariffSlab(100.0, 3.72), new TariffSlab(300.0, 5.55),
                            new TariffSlab(500.0, 7.10), new TariffSlab(null, 8.60)), today));

            seed.add(seedRow(UtilityType.ELECTRICITY, "BEST Undertaking", "Residential (LT)", "₹/kWh",
                    "South Mumbai supply; actual bill includes fixed/demand charges.",
                    List.of(new TariffSlab(100.0, 3.58), new TariffSlab(300.0, 5.40),
                            new TariffSlab(500.0, 6.95), new TariffSlab(null, 8.45)), today));

            seed.add(seedRow(UtilityType.ELECTRICITY, "MSEDCL (Greater Mumbai periphery)", "Residential (LT)", "₹/kWh",
                    "Many Navi Mumbai / Thane areas; confirm category (BPL/Telescopic) on bill.",
                    List.of(new TariffSlab(100.0, 3.52), new TariffSlab(300.0, 5.38),
                            new TariffSlab(500.0, 6.88), new TariffSlab(null, 8.35)), today));

            seed.add(seedRow(UtilityType.WATER, "BMC / MCGM (potable water)", "Domestic — metered", "₹/kl (per 1000 L)",
                    "Illustrative domestic slab rates; connection size and sewerage may apply separately.",
                    List.of(new TariffSlab(500.0, 5.22), new TariffSlab(960.0, 11.34),
                            new TariffSlab(1500.0, 19.44), new TariffSlab(null, 36.00)), today));

            seed.add(seedRow(UtilityType.WATER, "Navi Mumbai Municipal Corp. (NMMC)", "Residential — metered", "₹/kl",
                    "Demo slab structure; check NMMC circular for current year.",
                    List.of(new TariffSlab(20.0, 4.50), new TariffSlab(40.0, 9.00),
                            new TariffSlab(80.0, 18.00), new TariffSlab(null, 32.00)), today));

            seed.add(seedRow(UtilityType.WATER, "TMC / Mira-Bhayander (indicative)", "Residential", "₹/kl",
                    "Representative; Thane region utilities vary by local body.",
                    List.of(new TariffSlab(15.0, 5.00), new TariffSlab(40.0, 12.00),
                            new TariffSlab(80.0, 22.00), new TariffSlab(null, 38.00)), today));

            tariffRepository.saveAll(seed);
            System.out.println("Tariff seed data bootstrapped successfully.");
        } catch (Exception e) {
            System.err.println("Warning: Could not check/bootstrap tariff seed data. " + e.getMessage());
        }
    }

    private TariffConfig seedRow(UtilityType type, String provider, String category, String unit, String note,
                                  List<TariffSlab> slabs, String effectiveFrom) {
        return new TariffConfig(type, provider, category, unit, note, slabs, 0.0, 0.0, effectiveFrom, null,
                true, true, null);
    }

    public TariffConfig getApplicableTariff(UtilityType type, String providerName, String category, LocalDate asOfDate) {
        String groupKey = TariffConfig.computeGroupKey(type, providerName, category);
        List<TariffConfig> versions = tariffRepository.findByGroupKey(groupKey);

        TariffConfig match = versions.stream()
                .filter(TariffConfig::isActive)
                .filter(t -> !LocalDate.parse(t.getEffectiveFrom()).isAfter(asOfDate))
                .filter(t -> t.getEffectiveTo() == null || !LocalDate.parse(t.getEffectiveTo()).isBefore(asOfDate))
                .max(Comparator.comparing(t -> LocalDate.parse(t.getEffectiveFrom())))
                .orElse(null);

        if (match != null) {
            return match;
        }

        match = versions.stream()
                .filter(t -> !LocalDate.parse(t.getEffectiveFrom()).isAfter(asOfDate))
                .max(Comparator.comparing(t -> LocalDate.parse(t.getEffectiveFrom())))
                .orElse(null);

        if (match != null) {
            return match;
        }

        throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR,
                "No tariff configuration found for " + groupKey + " as of " + asOfDate + ". Seed data may be broken.");
    }

    public TariffConfig getDefaultElectricityTariff() {
        return defaultFor(UtilityType.ELECTRICITY);
    }

    public TariffConfig getDefaultWaterTariff() {
        return defaultFor(UtilityType.WATER);
    }

    private TariffConfig defaultFor(UtilityType type) {
        List<TariffConfig> active = tariffRepository.findByUtilityTypeAndActiveTrue(type);
        if (active.isEmpty()) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "No active tariff configured for " + type + ". Seed data may be broken.");
        }
        return active.stream()
                .min(Comparator.comparing(TariffConfig::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder())))
                .orElse(active.get(0));
    }

    public TariffCatalogResponse getPublicCatalog() {
        List<TariffPlan> electricity = tariffRepository.findByUtilityTypeAndActiveTrue(UtilityType.ELECTRICITY)
                .stream().map(this::toPlan).toList();
        List<TariffPlan> water = tariffRepository.findByUtilityTypeAndActiveTrue(UtilityType.WATER)
                .stream().map(this::toPlan).toList();
        return new TariffCatalogResponse(electricity, water);
    }

    private TariffPlan toPlan(TariffConfig config) {
        return new TariffPlan(config.getProviderName(), config.getCategory(), config.getUnit(), config.getNote(),
                config.getSlabs());
    }

    public List<TariffConfig> listTariffs(String token, UtilityType filterType) {
        authService.requireAdmin(token);
        List<TariffConfig> all = filterType == null
                ? tariffRepository.findAll()
                : tariffRepository.findByUtilityType(filterType);
        return all.stream()
                .sorted(Comparator.comparing(TariffConfig::getGroupKey)
                        .thenComparing(Comparator.comparing(TariffConfig::getEffectiveFrom).reversed()))
                .toList();
    }

    public TariffConfig createProvider(String token, CreateTariffRequest request) {
        UserAccount admin = authService.requireAdmin(token);
        validateRequest(request);
        String groupKey = TariffConfig.computeGroupKey(request.utilityType(), request.providerName(), request.category());
        if (!tariffRepository.findByGroupKey(groupKey).isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                    "A provider/category with this combination already exists. Use the 'new rate version' action instead.");
        }
        TariffConfig config = new TariffConfig(
                request.utilityType(), request.providerName(), request.category(), request.unit(), request.note(),
                request.slabs(), request.fixedCharges(), request.taxesPercent(), request.effectiveFrom(), null,
                true, false, admin.getId()
        );
        return tariffRepository.save(config);
    }

    public TariffConfig addRateVersion(String token, String groupKey, CreateTariffRequest request) {
        UserAccount admin = authService.requireAdmin(token);
        validateRequest(request);
        if (groupKey == null || groupKey.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "groupKey is required.");
        }
        List<TariffConfig> existing = tariffRepository.findByGroupKey(groupKey);
        if (existing.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                    "No existing provider/category found for this groupKey. Use 'create provider' instead.");
        }

        LocalDate newEffectiveFrom = LocalDate.parse(request.effectiveFrom());
        List<TariffConfig> openEnded = existing.stream().filter(t -> t.getEffectiveTo() == null).toList();

        for (TariffConfig open : openEnded) {
            LocalDate openFrom = LocalDate.parse(open.getEffectiveFrom());
            if (!newEffectiveFrom.isAfter(openFrom)) {
                throw new ApiException(HttpStatus.BAD_REQUEST,
                        "New version's effective-from date must be after the currently active version's start date ("
                                + openFrom + ").");
            }
        }

        for (TariffConfig open : openEnded) {
            open.setEffectiveTo(newEffectiveFrom.minusDays(1).format(DateTimeFormatter.ISO_LOCAL_DATE));
            tariffRepository.save(open);
        }

        TariffConfig first = existing.get(0);
        TariffConfig newVersion = new TariffConfig(
                first.getUtilityType(), first.getProviderName(), first.getCategory(), request.unit(), request.note(),
                request.slabs(), request.fixedCharges(), request.taxesPercent(), request.effectiveFrom(), null,
                true, false, admin.getId()
        );
        return tariffRepository.save(newVersion);
    }

    public TariffConfig setActive(String token, String id, boolean active) {
        authService.requireAdmin(token);
        TariffConfig config = tariffRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Tariff configuration not found."));
        config.setActive(active);
        return tariffRepository.save(config);
    }

    public List<TariffConfig> getHistory(String token, String groupKey) {
        authService.requireAdmin(token);
        return tariffRepository.findByGroupKey(groupKey).stream()
                .sorted(Comparator.comparing(TariffConfig::getEffectiveFrom))
                .toList();
    }

    private void validateRequest(CreateTariffRequest request) {
        if (request.utilityType() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "utilityType is required.");
        }
        if (request.providerName() == null || request.providerName().isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "providerName is required.");
        }
        if (request.slabs() == null || request.slabs().isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "At least one tariff slab is required.");
        }
        if (request.effectiveFrom() == null || request.effectiveFrom().isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "effectiveFrom is required.");
        }
        try {
            LocalDate.parse(request.effectiveFrom());
        } catch (Exception e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "effectiveFrom must be an ISO date (yyyy-MM-dd).");
        }
    }
}
