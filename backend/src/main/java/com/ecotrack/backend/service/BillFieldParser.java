package com.ecotrack.backend.service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeFormatterBuilder;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Best-effort field extraction from the raw text of an Indian electricity/water bill.
 *
 * Bill layouts differ between providers, so this is deliberately heuristic: labelled values are
 * preferred over "the first number with a rupee sign", and anything that cannot be found with
 * reasonable confidence is simply left as {@code null} rather than guessed. Callers must treat
 * every field as a suggestion the user can correct, never as ground truth.
 *
 * Pure Java, no Spring, no I/O — so it can be unit-tested against realistic text fixtures.
 */
public class BillFieldParser {

    /** Outcome of one parse pass. A {@code null} member means "not found", which is legitimate. */
    public static class Fields {
        private Double amount;
        private Double units;
        private Double previousReading;
        private Double currentReading;
        private String issueDate;
        private String dueDate;
        private String billingPeriod;
        private String billingPeriodStart;
        private String billingPeriodEnd;
        private String consumerNumber;
        private final List<String> fieldsFound = new ArrayList<>();

        public Double getAmount() { return amount; }
        public void setAmount(Double amount) { this.amount = amount; }

        public Double getUnits() { return units; }
        public void setUnits(Double units) { this.units = units; }

        public Double getPreviousReading() { return previousReading; }
        public void setPreviousReading(Double previousReading) { this.previousReading = previousReading; }

        public Double getCurrentReading() { return currentReading; }
        public void setCurrentReading(Double currentReading) { this.currentReading = currentReading; }

        public String getIssueDate() { return issueDate; }
        public void setIssueDate(String issueDate) { this.issueDate = issueDate; }

        public String getDueDate() { return dueDate; }
        public void setDueDate(String dueDate) { this.dueDate = dueDate; }

        public String getBillingPeriod() { return billingPeriod; }
        public void setBillingPeriod(String billingPeriod) { this.billingPeriod = billingPeriod; }

        public String getBillingPeriodStart() { return billingPeriodStart; }
        public void setBillingPeriodStart(String billingPeriodStart) { this.billingPeriodStart = billingPeriodStart; }

        public String getBillingPeriodEnd() { return billingPeriodEnd; }
        public void setBillingPeriodEnd(String billingPeriodEnd) { this.billingPeriodEnd = billingPeriodEnd; }

        public String getConsumerNumber() { return consumerNumber; }
        public void setConsumerNumber(String consumerNumber) { this.consumerNumber = consumerNumber; }

        public List<String> getFieldsFound() { return List.copyOf(fieldsFound); }

        void markFound(String name) { fieldsFound.add(name); }
    }

    /**
     * Characters allowed between a label and its value. Deliberately excludes digits so the gap
     * can never swallow the number itself, and allows the common currency markers so
     * "Net Payable Rs. 1,245.00" still matches.
     */
    private static final String GAP = "(?:\\s|[:#\\-.,₹]|rs\\.?|inr)*";

    /** A number token, tolerant of the characters Tesseract most often confuses with digits. */
    private static final String NUMBER = "([0-9OoIlS|][0-9OoIlS|,.]*)";

    /** Priority ordered: the most explicit "total payable" wording must win over generic ones. */
    private static final String[] AMOUNT_LABELS = {
            "net\\s*payable",
            "total\\s*amount\\s*payable",
            "amount\\s*payable",
            "payable\\s*amount",
            "net\\s*bill\\s*amount",
            "total\\s*bill\\s*amount",
            "amount\\s*due",
            "total\\s*due",
            "current\\s*bill\\s*amount",
            "current\\s*bill",
            "grand\\s*total",
            "total\\s*bill",
            "total\\s*amount",
            "total\\s*charges",
            "bill\\s*amount",
    };

    private static final Pattern[] AMOUNT_PATTERNS = buildPatterns(AMOUNT_LABELS, NUMBER);

    /** Currency-prefixed numbers, guarded so the "rs" inside words like "meters" cannot match. */
    private static final Pattern CURRENCY_NUMBER = Pattern.compile(
            "(?<![A-Za-z])(?:₹|rs\\.?|inr)\\s*" + NUMBER, Pattern.CASE_INSENSITIVE);

    /** Money-looking numbers (always two decimals) used only as a last-resort amount fallback. */
    private static final Pattern DECIMAL_NUMBER = Pattern.compile("([0-9OoIlS|][0-9OoIlS|,]*\\.[0-9]{2})");

    private static final String[] ELECTRICITY_UNIT_LABELS = {
            "units\\s*consumed", "total\\s*consumption", "net\\s*units", "units\\s*billed",
            "energy\\s*consumed", "consumption", "units",
    };

    private static final String[] WATER_UNIT_LABELS = {
            "units\\s*consumed", "total\\s*consumption", "water\\s*consumed", "net\\s*units",
            "water\\s*used", "consumption", "units",
    };

    private static final Pattern[] ELECTRICITY_LABEL_PATTERNS =
            buildPatterns(ELECTRICITY_UNIT_LABELS, NUMBER);
    private static final Pattern[] WATER_LABEL_PATTERNS =
            buildPatterns(WATER_UNIT_LABELS, NUMBER);

    private static final String ELECTRICITY_UNIT_TOKEN = "(?:kwh|kw\\s*h|units?)";
    private static final String WATER_UNIT_TOKEN = "(?:k?l|cubic\\s*met(?:re|er)s?|cum|m3)";

    private static final Pattern[] PREVIOUS_READING_PATTERNS = buildPatterns(new String[]{
            "previous\\s*(?:meter\\s*)?reading", "previous\\s*reading", "last\\s*reading",
            "prev\\.?\\s*reading", "opening\\s*reading",
    }, NUMBER);

    private static final Pattern[] CURRENT_READING_PATTERNS = buildPatterns(new String[]{
            "current\\s*(?:meter\\s*)?reading", "present\\s*(?:meter\\s*)?reading",
            "current\\s*reading", "closing\\s*reading", "latest\\s*reading",
    }, NUMBER);

    /**
     * A date as it appears on a bill: ISO, dd/MM/yyyy-style, or "15 Nov 2026" style. Captured as
     * one group so it can be normalised afterwards.
     */
    private static final String DATE = "(\\d{4}-\\d{2}-\\d{2}"
            + "|\\d{1,2}[/\\-.]\\d{1,2}[/\\-.]\\d{2,4}"
            + "|\\d{1,2}[\\s\\-][A-Za-z]{3,9}[\\s\\-,]{0,2}\\d{2,4})";

    private static final Pattern[] ISSUE_DATE_PATTERNS = buildPatterns(new String[]{
            "bill\\s*date", "issue\\s*date", "billing\\s*date", "invoice\\s*date", "date\\s*of\\s*issue",
    }, DATE);

    private static final Pattern[] DUE_DATE_PATTERNS = buildPatterns(new String[]{
            "due\\s*date", "payment\\s*due\\s*date", "last\\s*date\\s*(?:of\\s*payment|for\\s*payment)?",
            "pay\\s*(?:by|before|on)", "due\\s*on", "due\\s*by",
    }, DATE);

    private static final Pattern[] PERIOD_LABELS = buildPatterns(new String[]{
            "billing\\s*period", "bill\\s*period", "reading\\s*period", "supply\\s*period", "period",
    }, "([\\s\\S]{0,120})");

    private static final Pattern PERIOD_RANGE = Pattern.compile(
            DATE + "\\s*(?:to|till|until|-|–|—|and)\\s*" + DATE, Pattern.CASE_INSENSITIVE);

    private static final Pattern[] CONSUMER_PATTERNS = buildPatterns(new String[]{
            "consumer\\s*(?:no|number|id)", "account\\s*(?:no|number|id)", "customer\\s*(?:id|no|number)",
            "contract\\s*account", "ca\\s*no", "kno", "service\\s*(?:no|number)", "connection\\s*no",
    }, "([A-Za-z0-9][A-Za-z0-9\\-/]{3,20})");

    private static final DateTimeFormatter[] TEXT_DATE_FORMATS = {
            new DateTimeFormatterBuilder().parseCaseInsensitive().appendPattern("d MMM yyyy").toFormatter(Locale.ENGLISH),
            new DateTimeFormatterBuilder().parseCaseInsensitive().appendPattern("d MMM yy").toFormatter(Locale.ENGLISH),
    };

    /** Parses {@code text} and returns whatever could be identified with reasonable confidence. */
    public Fields parse(String text, String utilityType) {
        Fields fields = new Fields();
        if (text == null || text.isBlank()) {
            return fields;
        }

        Double amount = findAmount(text);
        if (amount != null) {
            fields.setAmount(amount);
            fields.markFound("amount");
        }

        Double previous = firstNumber(PREVIOUS_READING_PATTERNS, text);
        Double current = firstNumber(CURRENT_READING_PATTERNS, text);
        if (previous != null) {
            fields.setPreviousReading(previous);
            fields.markFound("previousReading");
        }
        if (current != null) {
            fields.setCurrentReading(current);
            fields.markFound("currentReading");
        }

        Double units = findUnits(text, utilityType);
        if (units == null && previous != null && current != null && current > previous) {
            // No labelled consumption figure, but the two meter readings were both readable —
            // the difference is almost always the consumption.
            units = round(current - previous);
        }
        if (units != null) {
            fields.setUnits(units);
            fields.markFound("units");
        }

        String issueDate = firstDate(ISSUE_DATE_PATTERNS, text);
        if (issueDate != null) {
            fields.setIssueDate(issueDate);
            fields.markFound("issueDate");
        }

        String dueDate = firstDate(DUE_DATE_PATTERNS, text);
        if (dueDate != null) {
            fields.setDueDate(dueDate);
            fields.markFound("dueDate");
        }

        applyBillingPeriod(fields, text);

        String consumerNumber = firstMatch(CONSUMER_PATTERNS, text);
        if (consumerNumber != null) {
            fields.setConsumerNumber(consumerNumber);
            fields.markFound("consumerNumber");
        }

        return fields;
    }

    // ---------------------------------------------------------------- amount

    Double findAmount(String text) {
        for (Pattern pattern : AMOUNT_PATTERNS) {
            Matcher matcher = pattern.matcher(text);
            while (matcher.find()) {
                Double value = cleanNumber(matcher.group(1));
                if (isPlausibleAmount(value)) {
                    return value;
                }
            }
        }

        // No label matched (heavily skewed layout or noisy OCR): the largest amount carrying a
        // currency marker is the best remaining guess.
        Double best = null;
        Matcher currency = CURRENCY_NUMBER.matcher(text);
        while (currency.find()) {
            Double value = cleanNumber(currency.group(1));
            if (isPlausibleAmount(value) && (best == null || value > best)) {
                best = value;
            }
        }
        if (best != null) {
            return best;
        }

        // Absolute last resort: the largest two-decimal number, which is money-shaped.
        Matcher decimal = DECIMAL_NUMBER.matcher(text);
        while (decimal.find()) {
            Double value = cleanNumber(decimal.group(1));
            if (isPlausibleAmount(value) && (best == null || value > best)) {
                best = value;
            }
        }
        return best;
    }

    // ----------------------------------------------------------------- units

    Double findUnits(String text, String utilityType) {
        boolean water = "WATER".equalsIgnoreCase(utilityType);

        Pattern[] labelPatterns = water ? WATER_LABEL_PATTERNS : ELECTRICITY_LABEL_PATTERNS;
        Double labelled = firstPlausibleNumber(labelPatterns, text);
        if (labelled != null) {
            return labelled;
        }

        String unitToken = water ? WATER_UNIT_TOKEN
                : "ELECTRICITY".equalsIgnoreCase(utilityType) ? ELECTRICITY_UNIT_TOKEN
                : "(?:" + ELECTRICITY_UNIT_TOKEN + "|" + WATER_UNIT_TOKEN + ")";
        Matcher matcher = Pattern.compile(NUMBER + "\\s*" + unitToken, Pattern.CASE_INSENSITIVE).matcher(text);
        while (matcher.find()) {
            Double value = cleanNumber(matcher.group(1));
            if (isPlausibleUnits(value)) {
                return value;
            }
        }
        return null;
    }

    // ----------------------------------------------------------------- dates

    private void applyBillingPeriod(Fields fields, String text) {
        for (Pattern labelPattern : PERIOD_LABELS) {
            Matcher matcher = labelPattern.matcher(text);
            if (!matcher.find()) {
                continue;
            }
            Matcher range = PERIOD_RANGE.matcher(matcher.group(1));
            if (range.find()) {
                String start = normalizeDate(range.group(1));
                String end = normalizeDate(range.group(2));
                if (start != null && end != null) {
                    fields.setBillingPeriodStart(start);
                    fields.setBillingPeriodEnd(end);
                    fields.setBillingPeriod(start + " to " + end);
                    fields.markFound("billingPeriod");
                    return;
                }
            }
        }

        // Some layouts print the range without any label at all.
        Matcher range = PERIOD_RANGE.matcher(text);
        if (range.find()) {
            String start = normalizeDate(range.group(1));
            String end = normalizeDate(range.group(2));
            if (start != null && end != null) {
                fields.setBillingPeriodStart(start);
                fields.setBillingPeriodEnd(end);
                fields.setBillingPeriod(start + " to " + end);
                fields.markFound("billingPeriod");
            }
        }
    }

    private String firstDate(Pattern[] patterns, String text) {
        for (Pattern pattern : patterns) {
            Matcher matcher = pattern.matcher(text);
            if (matcher.find()) {
                String normalized = normalizeDate(matcher.group(1));
                if (normalized != null) {
                    return normalized;
                }
            }
        }
        return null;
    }

    /** Accepts ISO, dd/MM/yyyy-style and "15 Nov 2026" dates; returns ISO {@code yyyy-MM-dd}. */
    static String normalizeDate(String raw) {
        if (raw == null) {
            return null;
        }
        String value = raw.trim().replaceAll("\\s+", " ");
        if (value.isEmpty()) {
            return null;
        }

        if (value.matches("\\d{4}-\\d{2}-\\d{2}")) {
            try {
                return LocalDate.parse(value).toString();
            } catch (DateTimeParseException e) {
                return null;
            }
        }

        if (value.matches("\\d{1,2}[/\\-.]\\d{1,2}[/\\-.]\\d{2,4}")) {
            String[] parts = value.split("[/\\-.]");
            try {
                int day = Integer.parseInt(parts[0]);
                int month = Integer.parseInt(parts[1]);
                int year = Integer.parseInt(parts[2]);
                if (year < 100) {
                    year += year < 70 ? 2000 : 1900;
                }
                if (month > 12 && day <= 12) {
                    // Looks like MM/dd/yyyy after all.
                    int swap = month;
                    month = day;
                    day = swap;
                }
                return LocalDate.of(year, month, day).toString();
            } catch (RuntimeException e) {
                return null;
            }
        }

        String cleaned = value.replace('-', ' ').replace(',', ' ').replace('.', ' ')
                .replaceAll("\\s+", " ").trim();
        for (DateTimeFormatter format : TEXT_DATE_FORMATS) {
            try {
                return LocalDate.parse(cleaned, format).toString();
            } catch (DateTimeParseException ignored) {
                // try the next format
            }
        }
        return null;
    }

    // -------------------------------------------------------------- helpers

    private Double firstNumber(Pattern[] patterns, String text) {
        for (Pattern pattern : patterns) {
            Matcher matcher = pattern.matcher(text);
            if (matcher.find()) {
                Double value = cleanNumber(matcher.group(1));
                if (value != null && value >= 0) {
                    return value;
                }
            }
        }
        return null;
    }

    private Double firstPlausibleNumber(Pattern[] patterns, String text) {
        for (Pattern pattern : patterns) {
            Matcher matcher = pattern.matcher(text);
            while (matcher.find()) {
                Double value = cleanNumber(matcher.group(1));
                if (isPlausibleUnits(value)) {
                    return value;
                }
            }
        }
        return null;
    }

    private String firstMatch(Pattern[] patterns, String text) {
        for (Pattern pattern : patterns) {
            Matcher matcher = pattern.matcher(text);
            if (matcher.find()) {
                String value = matcher.group(1).trim();
                if (!value.isEmpty()) {
                    return value;
                }
            }
        }
        return null;
    }

    private static Pattern[] buildPatterns(String[] labels, String valueGroup) {
        Pattern[] patterns = new Pattern[labels.length];
        for (int i = 0; i < labels.length; i++) {
            patterns[i] = Pattern.compile(labels[i] + GAP + valueGroup, Pattern.CASE_INSENSITIVE);
        }
        return patterns;
    }

    private static boolean isPlausibleAmount(Double value) {
        return value != null && value >= 1 && value <= 1_000_000;
    }

    private static boolean isPlausibleUnits(Double value) {
        return value != null && value > 0 && value <= 1_000_000;
    }

    private static double round(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    /**
     * Turns a captured token into a number, repairing the digit/letter confusions OCR commonly
     * produces (O→0, l/I→1, S→5) and dropping thousands separators. Returns {@code null} when the
     * token is not number-shaped, so a stray word can never become a value.
     */
    static Double cleanNumber(String token) {
        if (token == null || token.isBlank()) {
            return null;
        }
        StringBuilder cleaned = new StringBuilder(token.length());
        for (char c : token.toCharArray()) {
            switch (c) {
                case 'O', 'o', 'D', 'Q' -> cleaned.append('0');
                case 'l', 'I', 'i', '|', '!' -> cleaned.append('1');
                case 'S', 's' -> cleaned.append('5');
                case ',', ' ', '\u00a0' -> { /* thousands separator / spacing */ }
                default -> cleaned.append(c);
            }
        }
        String value = cleaned.toString();
        if (!value.matches("\\d+(\\.\\d+)?")) {
            return null;
        }
        try {
            return round(Double.parseDouble(value));
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
