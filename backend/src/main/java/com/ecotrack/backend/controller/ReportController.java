package com.ecotrack.backend.controller;

import com.ecotrack.backend.service.ReportService;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Locale;

/**
 * Personal report/export endpoints — every report here is scoped to the caller's own data
 * (see ReportService). Distinct from AdminExportController's admin-only user export.
 */
@RestController
@RequestMapping("/api/reports")
public class ReportController {

    private final ReportService reportService;

    public ReportController(ReportService reportService) {
        this.reportService = reportService;
    }

    @GetMapping("/bills")
    public ResponseEntity<byte[]> bills(
            @RequestHeader("X-Session-Token") String token,
            @RequestParam(required = false) String utilityType,
            @RequestParam(defaultValue = "excel") String format
    ) {
        byte[] file = reportService.exportBillsReport(token, utilityType, format);
        return respond(file, format, "bills-report");
    }

    @GetMapping("/appliances")
    public ResponseEntity<byte[]> appliances(
            @RequestHeader("X-Session-Token") String token,
            @RequestParam(defaultValue = "excel") String format
    ) {
        byte[] file = reportService.exportApplianceReport(token, format);
        return respond(file, format, "appliance-report");
    }

    @GetMapping("/payment-history")
    public ResponseEntity<byte[]> paymentHistory(
            @RequestHeader("X-Session-Token") String token,
            @RequestParam(defaultValue = "excel") String format
    ) {
        byte[] file = reportService.exportPaymentHistoryReport(token, format);
        return respond(file, format, "payment-history-report");
    }

    @GetMapping("/annual")
    public ResponseEntity<byte[]> annual(
            @RequestHeader("X-Session-Token") String token,
            @RequestParam int year,
            @RequestParam(defaultValue = "excel") String format
    ) {
        byte[] file = reportService.exportAnnualReport(token, year, format);
        return respond(file, format, "annual-report-" + year);
    }

    private ResponseEntity<byte[]> respond(byte[] file, String format, String baseFilename) {
        boolean isPdf = "pdf".equalsIgnoreCase(format == null ? "" : format.trim());
        String extension = isPdf ? "pdf" : "xlsx";
        MediaType mediaType = isPdf
                ? MediaType.APPLICATION_PDF
                : MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(baseFilename.toLowerCase(Locale.ROOT) + "." + extension)
                        .build()
                        .toString())
                .contentType(mediaType)
                .body(file);
    }
}
