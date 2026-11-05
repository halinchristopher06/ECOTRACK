package com.ecotrack.backend.controller;

import com.ecotrack.backend.dto.CreateBillRequest;
import com.ecotrack.backend.dto.MarkPaidRequest;
import com.ecotrack.backend.dto.OcrExtractionResult;
import com.ecotrack.backend.dto.UpdateBillRequest;
import com.ecotrack.backend.model.Bill;
import com.ecotrack.backend.service.BillService;
import jakarta.validation.Valid;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/bills")
public class BillController {

    private final BillService billService;

    public BillController(BillService billService) {
        this.billService = billService;
    }

    // Multipart upload: the file comes as the "file" part, and the (optional) utility type as a
    // plain form field "utilityType" — kept as simple @RequestParam fields rather than a nested
    // JSON "metadata" part, since this step only needs the file plus one hint for OCR extraction;
    // all the other bill fields are collected afterwards in the verification form and sent as
    // plain JSON to POST /api/bills.
    @PostMapping("/upload")
    public OcrExtractionResult upload(
            @RequestHeader("X-Session-Token") String token,
            @RequestPart("file") MultipartFile file,
            @RequestParam(value = "utilityType", required = false) String utilityType
    ) {
        return billService.uploadAndExtract(token, file, utilityType);
    }

    @PostMapping
    public Bill create(@RequestHeader("X-Session-Token") String token, @Valid @RequestBody CreateBillRequest request) {
        return billService.createBill(token, request);
    }

    @GetMapping
    public List<Bill> list(
            @RequestHeader("X-Session-Token") String token,
            @RequestParam(required = false) String utilityType,
            @RequestParam(required = false) String paymentStatus,
            @RequestParam(required = false) String billingMonth
    ) {
        return billService.listBills(token, utilityType, paymentStatus, billingMonth);
    }

    @GetMapping("/{id}")
    public Bill get(@RequestHeader("X-Session-Token") String token, @PathVariable String id) {
        return billService.getBill(token, id);
    }

    @PutMapping("/{id}")
    public Bill update(
            @RequestHeader("X-Session-Token") String token,
            @PathVariable String id,
            @RequestBody UpdateBillRequest request
    ) {
        return billService.updateBill(token, id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@RequestHeader("X-Session-Token") String token, @PathVariable String id) {
        billService.deleteBill(token, id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}/mark-paid")
    public Bill markPaid(
            @RequestHeader("X-Session-Token") String token,
            @PathVariable String id,
            @RequestBody(required = false) MarkPaidRequest request
    ) {
        String paymentDate = request != null ? request.paymentDate() : null;
        return billService.markPaid(token, id, paymentDate);
    }

    @GetMapping("/{id}/document")
    public ResponseEntity<byte[]> downloadDocument(@RequestHeader("X-Session-Token") String token, @PathVariable String id) {
        Bill bill = billService.getBill(token, id);
        byte[] bytes = billService.getDocumentBytes(token, id);
        String filename = bill.getDocumentOriginalName() != null ? bill.getDocumentOriginalName() : "bill-document";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(filename)
                        .build()
                        .toString())
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(bytes);
    }
}
