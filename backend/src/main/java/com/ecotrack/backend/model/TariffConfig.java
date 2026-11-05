package com.ecotrack.backend.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Document(collection = "tariffs")
public class TariffConfig {
    @Id
    private String id;

    @Indexed
    private String groupKey;

    private UtilityType utilityType;
    private String providerName;
    private String category;
    private String unit;
    private String note;
    private List<TariffSlab> slabs;
    private Double fixedCharges;
    private Double taxesPercent;
    private String effectiveFrom;
    private String effectiveTo;
    private boolean active;
    private boolean seedData;
    private Instant createdAt;
    private String createdByUserId;

    public TariffConfig() {}

    public static String computeGroupKey(UtilityType utilityType, String providerName, String category) {
        String type = utilityType == null ? "" : utilityType.name();
        String provider = providerName == null ? "" : providerName.trim();
        String cat = category == null ? "" : category.trim();
        return (type + "::" + provider + "::" + cat).toLowerCase(Locale.ROOT);
    }

    public TariffConfig(UtilityType utilityType, String providerName, String category, String unit, String note,
                         List<TariffSlab> slabs, Double fixedCharges, Double taxesPercent, String effectiveFrom,
                         String effectiveTo, boolean active, boolean seedData, String createdByUserId) {
        this.id = UUID.randomUUID().toString();
        this.utilityType = utilityType;
        this.providerName = providerName;
        this.category = category;
        this.unit = unit;
        this.note = note;
        this.slabs = slabs;
        this.fixedCharges = fixedCharges == null ? 0.0 : fixedCharges;
        this.taxesPercent = taxesPercent == null ? 0.0 : taxesPercent;
        this.effectiveFrom = effectiveFrom;
        this.effectiveTo = effectiveTo;
        this.active = active;
        this.seedData = seedData;
        this.createdAt = Instant.now();
        this.createdByUserId = createdByUserId;
        this.groupKey = computeGroupKey(utilityType, providerName, category);
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getGroupKey() {
        return groupKey;
    }

    public void setGroupKey(String groupKey) {
        this.groupKey = groupKey;
    }

    public UtilityType getUtilityType() {
        return utilityType;
    }

    public void setUtilityType(UtilityType utilityType) {
        this.utilityType = utilityType;
    }

    public String getProviderName() {
        return providerName;
    }

    public void setProviderName(String providerName) {
        this.providerName = providerName;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getUnit() {
        return unit;
    }

    public void setUnit(String unit) {
        this.unit = unit;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }

    public List<TariffSlab> getSlabs() {
        return slabs;
    }

    public void setSlabs(List<TariffSlab> slabs) {
        this.slabs = slabs;
    }

    public Double getFixedCharges() {
        return fixedCharges;
    }

    public void setFixedCharges(Double fixedCharges) {
        this.fixedCharges = fixedCharges;
    }

    public Double getTaxesPercent() {
        return taxesPercent;
    }

    public void setTaxesPercent(Double taxesPercent) {
        this.taxesPercent = taxesPercent;
    }

    public String getEffectiveFrom() {
        return effectiveFrom;
    }

    public void setEffectiveFrom(String effectiveFrom) {
        this.effectiveFrom = effectiveFrom;
    }

    public String getEffectiveTo() {
        return effectiveTo;
    }

    public void setEffectiveTo(String effectiveTo) {
        this.effectiveTo = effectiveTo;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    public boolean isSeedData() {
        return seedData;
    }

    public void setSeedData(boolean seedData) {
        this.seedData = seedData;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public String getCreatedByUserId() {
        return createdByUserId;
    }

    public void setCreatedByUserId(String createdByUserId) {
        this.createdByUserId = createdByUserId;
    }
}
