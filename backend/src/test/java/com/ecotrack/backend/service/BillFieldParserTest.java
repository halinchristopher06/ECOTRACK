package com.ecotrack.backend.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Unit tests for {@link BillFieldParser}, driven by realistic (and realistically mangled) bill text.
 *
 * <p>The fixtures deliberately mix layouts from real Indian providers — MSEDCL, Adani Electricity,
 * BEST, Tata Power and municipal water boards — plus noisy-OCR variants, because that is exactly the
 * input the parser sees in production and the wording/labelling differs significantly between them.
 */
class BillFieldParserTest {

    private final BillFieldParser parser = new BillFieldParser();

    // ------------------------------------------------------------------ electricity

    @Test
    @DisplayName("MSEDCL electricity bill: labelled amount, units, readings, dates and period")
    void parsesCleanMsedclBill() {
        String text = """
                MAHARASHTRA STATE ELECTRICITY DISTRIBUTION CO. LTD.
                Consumer No: 180001234567
                Billing Period: 01/10/2026 to 31/10/2026
                Bill Date: 02/11/2026
                Due Date: 15/11/2026
                Previous Reading: 45210
                Current Reading: 45522
                Units Consumed: 312
                Energy Charges: Rs. 2,150.00
                Fixed Charges: Rs. 130.00
                Net Payable: Rs. 2,412.00
                """;

        BillFieldParser.Fields fields = parser.parse(text, "ELECTRICITY");

        // "Net Payable" must win over the earlier, smaller "Energy Charges" amount.
        assertValue(2412.00, fields.getAmount());
        assertValue(312, fields.getUnits());
        assertValue(45210, fields.getPreviousReading());
        assertValue(45522, fields.getCurrentReading());
        assertEquals("2026-11-02", fields.getIssueDate());
        assertEquals("2026-11-15", fields.getDueDate());
        assertEquals("2026-10-01", fields.getBillingPeriodStart());
        assertEquals("2026-10-31", fields.getBillingPeriodEnd());
        assertEquals("180001234567", fields.getConsumerNumber());
        assertTrue(fields.getFieldsFound().contains("amount"));
        assertTrue(fields.getFieldsFound().contains("units"));
    }

    @Test
    @DisplayName("Adani Electricity bill with noisy OCR (O/I substituted for 0/1)")
    void parsesNoisyAdaniBill() {
        String text = """
                ADANI ELECTRICITY MUMBAI LIMITED
                Consumer Number: 100234567
                Bill Date: 05/11/2026
                Due Date: 20/11/2026
                Previous Reading 89012
                Current Reading 894I7
                Units Consumed 4I5
                Net Payable Rs. I,245.00
                """;

        BillFieldParser.Fields fields = parser.parse(text, "ELECTRICITY");

        assertValue(1245.00, fields.getAmount());
        assertValue(415, fields.getUnits());
        assertValue(89012, fields.getPreviousReading());
        assertValue(89417, fields.getCurrentReading());
        assertEquals("2026-11-05", fields.getIssueDate());
        assertEquals("2026-11-20", fields.getDueDate());
        assertEquals("100234567", fields.getConsumerNumber());
    }

    @Test
    @DisplayName("BEST bill: 'Total Amount Payable' and 'Units Billed', dd-MM-yyyy period")
    void parsesBestBill() {
        String text = """
                BEST UNDERTAKING
                Consumer No: 44100123
                Bill Period 01-10-2026 to 31-10-2026
                Bill Date 03/11/2026
                Due Date 18/11/2026
                Units Billed 210
                Total Amount Payable Rs. 1,980.50
                """;

        BillFieldParser.Fields fields = parser.parse(text, "ELECTRICITY");

        assertValue(1980.50, fields.getAmount());
        assertValue(210, fields.getUnits());
        assertEquals("2026-11-03", fields.getIssueDate());
        assertEquals("2026-11-18", fields.getDueDate());
        assertEquals("2026-10-01", fields.getBillingPeriodStart());
        assertEquals("2026-10-31", fields.getBillingPeriodEnd());
        assertEquals("44100123", fields.getConsumerNumber());
    }

    @Test
    @DisplayName("Tata Power bill: 'Amount Due' with 'Total Consumption' in kWh")
    void parsesTataPowerBill() {
        String text = """
                TATA POWER
                Consumer ID: 70123456
                Bill Date: 09/11/2026
                Due Date: 24/11/2026
                Previous Meter Reading: 12000
                Current Meter Reading: 12360
                Total Consumption: 360 kWh
                Amount Due: Rs 2,345.75
                """;

        BillFieldParser.Fields fields = parser.parse(text, "ELECTRICITY");

        assertValue(2345.75, fields.getAmount());
        assertValue(360, fields.getUnits());
        assertValue(12000, fields.getPreviousReading());
        assertValue(12360, fields.getCurrentReading());
        assertEquals("2026-11-09", fields.getIssueDate());
        assertEquals("2026-11-24", fields.getDueDate());
        assertEquals("70123456", fields.getConsumerNumber());
    }

    // ----------------------------------------------------------------------- water

    @Test
    @DisplayName("Municipal water bill: 'Water Consumed' in KL")
    void parsesCleanWaterBill() {
        String text = """
                MUNICIPAL CORPORATION WATER BILL
                Consumer Number: WTR0098112
                Bill Date: 04/11/2026
                Due Date: 19/11/2026
                Billing Period: 01/10/2026 to 31/10/2026
                Previous Reading: 450
                Current Reading: 468
                Water Consumed: 18 KL
                Total Amount Payable: Rs. 540.00
                """;

        BillFieldParser.Fields fields = parser.parse(text, "WATER");

        assertValue(540.00, fields.getAmount());
        assertValue(18, fields.getUnits());
        assertValue(450, fields.getPreviousReading());
        assertValue(468, fields.getCurrentReading());
        assertEquals("2026-11-04", fields.getIssueDate());
        assertEquals("2026-11-19", fields.getDueDate());
        assertEquals("WTR0098112", fields.getConsumerNumber());
    }

    @Test
    @DisplayName("Noisy water bill: 'Consumption ... kL' and 'Total Bill Amount'")
    void parsesLooseWaterBill() {
        String text = """
                MUNICIPAL WATER BOARD
                Account No: 88231907
                Bill Date 10/11/2026 Due Date 25/11/2026
                Consumption 22 kL
                Total Bill Amount Rs. 660.00
                """;

        BillFieldParser.Fields fields = parser.parse(text, "WATER");

        assertValue(660.00, fields.getAmount());
        assertValue(22, fields.getUnits());
        assertEquals("2026-11-10", fields.getIssueDate());
        assertEquals("2026-11-25", fields.getDueDate());
        assertEquals("88231907", fields.getConsumerNumber());
    }

    // ----------------------------------------------------------- fall-backs / derivation

    @Test
    @DisplayName("No payable label: falls back to the largest currency-marked amount")
    void fallsBackToLargestCurrencyAmount() {
        String text = """
                ELECTRICITY BILL STATEMENT
                Consumer No 55667788
                Amount Rs. 3,500.00
                Late Payment Charges Rs. 120.00
                """;

        BillFieldParser.Fields fields = parser.parse(text, "ELECTRICITY");

        assertValue(3500.00, fields.getAmount());
        assertNull(fields.getUnits(), "no consumption figure is present on this bill");
        assertEquals("55667788", fields.getConsumerNumber());
    }

    @Test
    @DisplayName("No labelled consumption: units derived from current - previous reading")
    void derivesUnitsFromMeterReadings() {
        String text = """
                ELECTRICITY SUPPLY
                Previous Meter Reading: 1000
                Current Meter Reading: 1245
                Net Payable Rs. 1,245.00
                """;

        BillFieldParser.Fields fields = parser.parse(text, "ELECTRICITY");

        assertValue(1245.00, fields.getAmount());
        assertValue(1000, fields.getPreviousReading());
        assertValue(1245, fields.getCurrentReading());
        assertValue(245, fields.getUnits());
    }

    @Test
    @DisplayName("Empty / unreadable text yields an empty result rather than throwing")
    void handlesEmptyText() {
        BillFieldParser.Fields empty = parser.parse("", "ELECTRICITY");
        assertNull(empty.getAmount());
        assertNull(empty.getUnits());
        assertTrue(empty.getFieldsFound().isEmpty());

        BillFieldParser.Fields nullText = parser.parse(null, "WATER");
        assertNull(nullText.getAmount());
    }

    // ------------------------------------------------------------------ date helpers

    @Test
    @DisplayName("normalizeDate accepts the common bill date formats and outputs ISO")
    void normalizesDates() {
        assertEquals("2026-11-15", BillFieldParser.normalizeDate("15/11/2026"));
        assertEquals("2026-11-15", BillFieldParser.normalizeDate("15-11-2026"));
        assertEquals("2026-11-15", BillFieldParser.normalizeDate("15.11.2026"));
        assertEquals("2026-11-15", BillFieldParser.normalizeDate("15 Nov 2026"));
        assertEquals("2026-11-15", BillFieldParser.normalizeDate("15-Nov-26"));
        assertEquals("2026-11-15", BillFieldParser.normalizeDate("2026-11-15"));
        // MM/dd/yyyy is recognised when the month slot cannot be a month.
        assertEquals("2026-12-25", BillFieldParser.normalizeDate("12/25/2026"));
        assertNull(BillFieldParser.normalizeDate("not a date"));
        assertNull(BillFieldParser.normalizeDate(""));
    }

    // ------------------------------------------------------------- number helpers

    @Test
    @DisplayName("cleanNumber repairs OCR digit/letter confusions and strips separators")
    void cleansNumbers() {
        assertValue(1245.00, BillFieldParser.cleanNumber("1,245.00"));
        assertValue(415, BillFieldParser.cleanNumber("4I5"));
        assertValue(0.5, BillFieldParser.cleanNumber("O.5"));
        assertValue(120, BillFieldParser.cleanNumber("I2O"));
        assertValue(55, BillFieldParser.cleanNumber("S5"));
        assertNull(BillFieldParser.cleanNumber("abc"));
        assertNull(BillFieldParser.cleanNumber(""));
        assertNull(BillFieldParser.cleanNumber(null));
    }

    private static void assertValue(double expected, Double actual) {
        assertNotNull(actual, "expected a value but the parser found none");
        assertEquals(expected, actual, 0.005);
    }
}
