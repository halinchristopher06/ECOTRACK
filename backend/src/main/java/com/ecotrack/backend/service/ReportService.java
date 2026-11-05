package com.ecotrack.backend.service;

import com.ecotrack.backend.dto.ApplianceBreakdownResponse;
import com.ecotrack.backend.dto.ApplianceCostBreakdown;
import com.ecotrack.backend.exception.ApiException;
import com.ecotrack.backend.model.Bill;
import com.ecotrack.backend.model.UserAccount;
import com.ecotrack.backend.repository.BillRepository;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.xssf.usermodel.XSSFFont;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

/**
 * Personal, per-user report/export generation (NOT the admin user export in
 * AdminExportController, which is untouched). Every method here requires a regular user
 * session and only ever reads that caller's own bills/appliances.
 */
@Service
public class ReportService {

    private final AuthService authService;
    private final BillRepository billRepository;
    private final ApplianceService applianceService;

    public ReportService(AuthService authService, BillRepository billRepository, ApplianceService applianceService) {
        this.authService = authService;
        this.billRepository = billRepository;
        this.applianceService = applianceService;
    }

    public byte[] exportBillsReport(String token, String utilityType, String format) {
        UserAccount user = authService.requireUser(token);
        List<Bill> bills = billRepository.findByUserId(user.getId()).stream()
                .filter(b -> utilityType == null || utilityType.isBlank() || utilityType.equalsIgnoreCase(b.getUtilityType()))
                .sorted(Comparator.comparing(Bill::getBillingMonth, Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();

        List<String> headers = List.of("Provider", "Utility Type", "Billing Month", "Units Consumed",
                "Bill Amount", "Payment Status", "Due Date");
        List<List<String>> rows = new ArrayList<>();
        for (Bill b : bills) {
            rows.add(List.of(
                    nullToDash(b.getProvider()),
                    nullToDash(b.getUtilityType()),
                    nullToDash(b.getBillingMonth()),
                    numberOrDash(b.getUnitsConsumed()),
                    numberOrDash(b.getBillAmount()),
                    nullToDash(b.getPaymentStatus()),
                    nullToDash(b.getDueDate())
            ));
        }

        String title = utilityType == null || utilityType.isBlank()
                ? "Combined Expense Report"
                : capitalize(utilityType) + " Monthly Report";
        return render(title, headers, rows, format);
    }

    public byte[] exportApplianceReport(String token, String format) {
        ApplianceBreakdownResponse breakdown = applianceService.getBreakdown(token);

        List<String> headers = List.of("Appliance", "Wattage (W)", "Quantity", "Hours/Day",
                "Monthly Cost", "Annual Cost", "Highest Cost");
        List<List<String>> rows = new ArrayList<>();
        for (ApplianceCostBreakdown a : breakdown.appliances()) {
            rows.add(List.of(
                    nullToDash(a.name()),
                    String.valueOf(a.wattage()),
                    String.valueOf(a.quantity()),
                    String.valueOf(a.hoursPerDay()),
                    String.valueOf(a.monthlyCost()),
                    String.valueOf(a.annualCost()),
                    a.isHighestCost() ? "Yes" : "No"
            ));
        }

        return render("Appliance Expense Report", headers, rows, format);
    }

    public byte[] exportPaymentHistoryReport(String token, String format) {
        UserAccount user = authService.requireUser(token);
        List<Bill> bills = billRepository.findByUserId(user.getId()).stream()
                .sorted(Comparator.comparing(Bill::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();

        List<String> headers = List.of("Provider", "Bill Amount", "Due Date", "Payment Status", "Payment Date");
        List<List<String>> rows = new ArrayList<>();
        for (Bill b : bills) {
            rows.add(List.of(
                    nullToDash(b.getProvider()),
                    numberOrDash(b.getBillAmount()),
                    nullToDash(b.getDueDate()),
                    nullToDash(b.getPaymentStatus()),
                    nullToDash(b.getPaymentDate())
            ));
        }

        return render("Payment History Report", headers, rows, format);
    }

    public byte[] exportAnnualReport(String token, int year, String format) {
        UserAccount user = authService.requireUser(token);
        String yearPrefix = String.valueOf(year);
        List<Bill> bills = billRepository.findByUserId(user.getId()).stream()
                .filter(b -> b.getBillingMonth() != null && b.getBillingMonth().startsWith(yearPrefix))
                .sorted(Comparator.comparing(Bill::getBillingMonth))
                .toList();

        List<String> headers = List.of("Billing Month", "Utility Type", "Units Consumed", "Bill Amount", "Payment Status");
        List<List<String>> rows = new ArrayList<>();
        double total = 0;
        for (Bill b : bills) {
            double amount = b.getBillAmount() != null ? b.getBillAmount() : 0;
            total += amount;
            rows.add(List.of(
                    nullToDash(b.getBillingMonth()),
                    nullToDash(b.getUtilityType()),
                    numberOrDash(b.getUnitsConsumed()),
                    numberOrDash(b.getBillAmount()),
                    nullToDash(b.getPaymentStatus())
            ));
        }
        rows.add(List.of("TOTAL", "", "", String.format(Locale.ROOT, "%.2f", total), ""));

        return render("Annual Report " + year, headers, rows, format);
    }

    private byte[] render(String title, List<String> headers, List<List<String>> rows, String format) {
        if (format == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "format is required (excel or pdf).");
        }
        return switch (format.trim().toLowerCase(Locale.ROOT)) {
            case "excel", "xlsx" -> writeExcel(title, headers, rows);
            case "pdf" -> writePdf(title, headers, rows);
            default -> throw new ApiException(HttpStatus.BAD_REQUEST,
                    "Unsupported format '" + format + "'. Use 'excel' or 'pdf'.");
        };
    }

    private byte[] writeExcel(String title, List<String> headers, List<List<String>> rows) {
        try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            var sheet = workbook.createSheet(title.length() > 31 ? title.substring(0, 31) : title);

            CellStyle headerStyle = workbook.createCellStyle();
            headerStyle.setFillForegroundColor(IndexedColors.DARK_BLUE.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            headerStyle.setAlignment(HorizontalAlignment.CENTER);
            XSSFFont font = workbook.createFont();
            font.setBold(true);
            font.setColor(IndexedColors.WHITE.getIndex());
            headerStyle.setFont(font);

            var headerRow = sheet.createRow(0);
            for (int i = 0; i < headers.size(); i++) {
                var cell = headerRow.createCell(i);
                cell.setCellValue(headers.get(i));
                cell.setCellStyle(headerStyle);
            }

            for (int r = 0; r < rows.size(); r++) {
                var row = sheet.createRow(r + 1);
                List<String> values = rows.get(r);
                for (int c = 0; c < values.size(); c++) {
                    row.createCell(c).setCellValue(values.get(c));
                }
            }

            for (int i = 0; i < headers.size(); i++) {
                sheet.autoSizeColumn(i);
            }

            workbook.write(out);
            return out.toByteArray();
        } catch (IOException ex) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not generate Excel report.");
        }
    }

    private byte[] writePdf(String title, List<String> headers, List<List<String>> rows) {
        try (PDDocument document = new PDDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            PDType1Font regular = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
            PDType1Font bold = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);

            float marginLeft = 40;
            float startY = PDRectangle.A4.getHeight() - 50;
            float rowHeight = 18;
            float columnWidth = Math.max(70, (PDRectangle.A4.getWidth() - 2 * marginLeft) / Math.max(1, headers.size()));
            int rowsPerPage = (int) ((startY - 60) / rowHeight);

            PDPage page = new PDPage(PDRectangle.A4);
            document.addPage(page);
            PDPageContentStream content = new PDPageContentStream(document, page);

            float y = startY;
            y = writeTitleAndHeader(content, bold, title, headers, marginLeft, y, columnWidth);

            int rowsOnPage = 0;
            for (List<String> row : rows) {
                if (rowsOnPage >= rowsPerPage) {
                    content.close();
                    page = new PDPage(PDRectangle.A4);
                    document.addPage(page);
                    content = new PDPageContentStream(document, page);
                    y = startY;
                    y = writeTitleAndHeader(content, bold, title, headers, marginLeft, y, columnWidth);
                    rowsOnPage = 0;
                }
                writeRow(content, regular, row, marginLeft, y, columnWidth);
                y -= rowHeight;
                rowsOnPage++;
            }
            content.close();

            document.save(out);
            return out.toByteArray();
        } catch (IOException ex) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not generate PDF report.");
        }
    }

    private float writeTitleAndHeader(PDPageContentStream content, PDType1Font bold, String title,
                                        List<String> headers, float marginLeft, float y, float columnWidth) throws IOException {
        content.beginText();
        content.setFont(bold, 14);
        content.newLineAtOffset(marginLeft, y);
        content.showText(title);
        content.endText();
        y -= 24;

        content.beginText();
        content.setFont(bold, 9);
        content.newLineAtOffset(marginLeft, y);
        for (int i = 0; i < headers.size(); i++) {
            if (i > 0) content.newLineAtOffset(columnWidth, 0);
            content.showText(truncate(headers.get(i), columnWidth));
        }
        content.endText();
        y -= 16;
        return y;
    }

    private void writeRow(PDPageContentStream content, PDType1Font regular, List<String> row,
                           float marginLeft, float y, float columnWidth) throws IOException {
        content.beginText();
        content.setFont(regular, 9);
        content.newLineAtOffset(marginLeft, y);
        for (int i = 0; i < row.size(); i++) {
            if (i > 0) content.newLineAtOffset(columnWidth, 0);
            content.showText(truncate(row.get(i), columnWidth));
        }
        content.endText();
    }

    private String truncate(String value, float columnWidth) {
        if (value == null) return "";
        int maxChars = Math.max(6, (int) (columnWidth / 5.2));
        return value.length() > maxChars ? value.substring(0, Math.max(0, maxChars - 3)) + "..." : value;
    }

    private String nullToDash(String value) {
        return value == null || value.isBlank() ? "-" : value;
    }

    private String numberOrDash(Double value) {
        return value == null ? "-" : String.format(Locale.ROOT, "%.2f", value);
    }

    private String capitalize(String value) {
        if (value == null || value.isBlank()) return value;
        return value.substring(0, 1).toUpperCase(Locale.ROOT) + value.substring(1).toLowerCase(Locale.ROOT);
    }
}
