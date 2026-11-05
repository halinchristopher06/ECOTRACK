package com.ecotrack.backend.dto;

import java.util.List;

public class OcrExtractionResult {
    private boolean ocrAvailable;
    private String rawText;
    private Double extractedAmount;
    private Double extractedUnits;
    private String extractedIssueDate;
    private String extractedDueDate;
    private String extractedBillingPeriod;
    // Echoed back so the frontend can pass these straight into POST /api/bills.
    private String documentPath;
    private String documentOriginalName;

    // --- Additive fields (backward compatible: existing clients simply ignore them). ---
    /** How the text was obtained: PDF_TEXT | OCR_IMAGE | OCR_SCANNED_PDF | NONE. */
    private String extractionMethod;
    /** Mean Tesseract word confidence (0-100). Null when the text came from PDFBox, not OCR. */
    private Integer confidence;
    /** Short human-readable explanation when {@code ocrAvailable} is false. */
    private String reason;
    private Double extractedPreviousReading;
    private Double extractedCurrentReading;
    private String extractedBillingPeriodStart;
    private String extractedBillingPeriodEnd;
    private String extractedConsumerNumber;
    /** Names of the fields the parser could identify, so the UI can flag anything missing. */
    private List<String> fieldsFound;

    public OcrExtractionResult() {}

    public boolean isOcrAvailable() {
        return ocrAvailable;
    }

    public void setOcrAvailable(boolean ocrAvailable) {
        this.ocrAvailable = ocrAvailable;
    }

    public String getRawText() {
        return rawText;
    }

    public void setRawText(String rawText) {
        this.rawText = rawText;
    }

    public Double getExtractedAmount() {
        return extractedAmount;
    }

    public void setExtractedAmount(Double extractedAmount) {
        this.extractedAmount = extractedAmount;
    }

    public Double getExtractedUnits() {
        return extractedUnits;
    }

    public void setExtractedUnits(Double extractedUnits) {
        this.extractedUnits = extractedUnits;
    }

    public String getExtractedIssueDate() {
        return extractedIssueDate;
    }

    public void setExtractedIssueDate(String extractedIssueDate) {
        this.extractedIssueDate = extractedIssueDate;
    }

    public String getExtractedDueDate() {
        return extractedDueDate;
    }

    public void setExtractedDueDate(String extractedDueDate) {
        this.extractedDueDate = extractedDueDate;
    }

    public String getExtractedBillingPeriod() {
        return extractedBillingPeriod;
    }

    public void setExtractedBillingPeriod(String extractedBillingPeriod) {
        this.extractedBillingPeriod = extractedBillingPeriod;
    }

    public String getDocumentPath() {
        return documentPath;
    }

    public void setDocumentPath(String documentPath) {
        this.documentPath = documentPath;
    }

    public String getDocumentOriginalName() {
        return documentOriginalName;
    }

    public void setDocumentOriginalName(String documentOriginalName) {
        this.documentOriginalName = documentOriginalName;
    }

    public String getExtractionMethod() {
        return extractionMethod;
    }

    public void setExtractionMethod(String extractionMethod) {
        this.extractionMethod = extractionMethod;
    }

    public Integer getConfidence() {
        return confidence;
    }

    public void setConfidence(Integer confidence) {
        this.confidence = confidence;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public Double getExtractedPreviousReading() {
        return extractedPreviousReading;
    }

    public void setExtractedPreviousReading(Double extractedPreviousReading) {
        this.extractedPreviousReading = extractedPreviousReading;
    }

    public Double getExtractedCurrentReading() {
        return extractedCurrentReading;
    }

    public void setExtractedCurrentReading(Double extractedCurrentReading) {
        this.extractedCurrentReading = extractedCurrentReading;
    }

    public String getExtractedBillingPeriodStart() {
        return extractedBillingPeriodStart;
    }

    public void setExtractedBillingPeriodStart(String extractedBillingPeriodStart) {
        this.extractedBillingPeriodStart = extractedBillingPeriodStart;
    }

    public String getExtractedBillingPeriodEnd() {
        return extractedBillingPeriodEnd;
    }

    public void setExtractedBillingPeriodEnd(String extractedBillingPeriodEnd) {
        this.extractedBillingPeriodEnd = extractedBillingPeriodEnd;
    }

    public String getExtractedConsumerNumber() {
        return extractedConsumerNumber;
    }

    public void setExtractedConsumerNumber(String extractedConsumerNumber) {
        this.extractedConsumerNumber = extractedConsumerNumber;
    }

    public List<String> getFieldsFound() {
        return fieldsFound;
    }

    public void setFieldsFound(List<String> fieldsFound) {
        this.fieldsFound = fieldsFound;
    }
}
