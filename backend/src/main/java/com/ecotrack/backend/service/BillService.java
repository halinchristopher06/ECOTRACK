package com.ecotrack.backend.service;

import com.ecotrack.backend.dto.CreateBillRequest;
import com.ecotrack.backend.dto.OcrExtractionResult;
import com.ecotrack.backend.dto.UpdateBillRequest;
import com.ecotrack.backend.exception.ApiException;
import com.ecotrack.backend.model.Bill;
import com.ecotrack.backend.model.UserAccount;
import com.ecotrack.backend.model.UserRole;
import com.ecotrack.backend.repository.BillRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@Service
public class BillService {

    private final BillRepository billRepository;
    private final AuthService authService;
    private final FileStorageService fileStorageService;
    private final OcrExtractionService ocrExtractionService;

    public BillService(
            BillRepository billRepository,
            AuthService authService,
            FileStorageService fileStorageService,
            OcrExtractionService ocrExtractionService
    ) {
        this.billRepository = billRepository;
        this.authService = authService;
        this.fileStorageService = fileStorageService;
        this.ocrExtractionService = ocrExtractionService;
    }

    public OcrExtractionResult uploadAndExtract(String token, MultipartFile file, String utilityType) {
        authService.requireUser(token);
        fileStorageService.validate(file);
        String extension = fileStorageService.getExtension(file.getOriginalFilename());
        String storedName = fileStorageService.store(file);

        // Run OCR directly against the stored file instead of writing a second temp copy of the
        // same bytes to disk.
        File storedFile = fileStorageService.resolvePath(storedName).toFile();
        OcrExtractionResult result = ocrExtractionService.extract(storedFile, extension, utilityType);
        result.setDocumentPath(storedName);
        result.setDocumentOriginalName(file.getOriginalFilename());
        return result;
    }

    public Bill createBill(String token, CreateBillRequest request) {
        UserAccount user = authService.requireUser(token);
        Bill bill = new Bill();
        bill.setId(UUID.randomUUID().toString());
        bill.setUserId(user.getId());
        bill.setProvider(request.provider());
        bill.setUtilityType(request.utilityType());
        bill.setBillingMonth(request.billingMonth());
        bill.setBillingPeriodStart(request.billingPeriodStart());
        bill.setBillingPeriodEnd(request.billingPeriodEnd());
        bill.setPreviousReading(request.previousReading());
        bill.setCurrentReading(request.currentReading());
        bill.setUnitsConsumed(request.unitsConsumed());
        bill.setBillAmount(request.billAmount());
        bill.setFixedCharges(request.fixedCharges());
        bill.setAdditionalCharges(request.additionalCharges());
        bill.setIssueDate(request.issueDate());
        bill.setDueDate(request.dueDate());
        bill.setPaymentStatus(request.paymentStatus() != null ? request.paymentStatus() : "PENDING");
        bill.setPaymentDate(request.paymentDate());
        bill.setDocumentPath(request.documentPath());
        bill.setDocumentOriginalName(request.documentOriginalName());
        bill.setEntrySource(request.entrySource() != null ? request.entrySource() : "MANUAL");
        Instant now = Instant.now();
        bill.setCreatedAt(now);
        bill.setUpdatedAt(now);
        return billRepository.save(bill);
    }

    public List<Bill> listBills(String token, String utilityType, String paymentStatus, String billingMonth) {
        UserAccount user = authService.requireUser(token);
        return billRepository.findByUserId(user.getId()).stream()
                .filter(b -> utilityType == null || utilityType.isBlank() || utilityType.equalsIgnoreCase(b.getUtilityType()))
                .filter(b -> paymentStatus == null || paymentStatus.isBlank() || paymentStatus.equalsIgnoreCase(b.getPaymentStatus()))
                .filter(b -> billingMonth == null || billingMonth.isBlank() || billingMonth.equals(b.getBillingMonth()))
                .sorted(Comparator.comparing(Bill::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
    }

    public Bill getBill(String token, String id) {
        return requireOwnedBill(token, id);
    }

    public Bill updateBill(String token, String id, UpdateBillRequest request) {
        Bill bill = requireOwnedBill(token, id);
        if (request.provider() != null) bill.setProvider(request.provider());
        if (request.utilityType() != null) bill.setUtilityType(request.utilityType());
        if (request.billingMonth() != null) bill.setBillingMonth(request.billingMonth());
        if (request.billingPeriodStart() != null) bill.setBillingPeriodStart(request.billingPeriodStart());
        if (request.billingPeriodEnd() != null) bill.setBillingPeriodEnd(request.billingPeriodEnd());
        if (request.previousReading() != null) bill.setPreviousReading(request.previousReading());
        if (request.currentReading() != null) bill.setCurrentReading(request.currentReading());
        if (request.unitsConsumed() != null) bill.setUnitsConsumed(request.unitsConsumed());
        if (request.billAmount() != null) bill.setBillAmount(request.billAmount());
        if (request.fixedCharges() != null) bill.setFixedCharges(request.fixedCharges());
        if (request.additionalCharges() != null) bill.setAdditionalCharges(request.additionalCharges());
        if (request.issueDate() != null) bill.setIssueDate(request.issueDate());
        if (request.dueDate() != null) bill.setDueDate(request.dueDate());
        if (request.paymentStatus() != null) bill.setPaymentStatus(request.paymentStatus());
        if (request.paymentDate() != null) bill.setPaymentDate(request.paymentDate());
        bill.setUpdatedAt(Instant.now());
        return billRepository.save(bill);
    }

    public void deleteBill(String token, String id) {
        Bill bill = requireOwnedBill(token, id);
        if (bill.getDocumentPath() != null) {
            fileStorageService.delete(bill.getDocumentPath());
        }
        billRepository.deleteById(bill.getId());
    }

    public Bill markPaid(String token, String id, String paymentDate) {
        Bill bill = requireOwnedBill(token, id);
        bill.setPaymentStatus("PAID");
        bill.setPaymentDate(paymentDate != null && !paymentDate.isBlank() ? paymentDate : LocalDate.now().toString());
        bill.setUpdatedAt(Instant.now());
        return billRepository.save(bill);
    }

    public byte[] getDocumentBytes(String token, String id) {
        Bill bill = requireOwnedBill(token, id);
        if (bill.getDocumentPath() == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "This bill has no attached document.");
        }
        return fileStorageService.readAsBytes(bill.getDocumentPath());
    }

    /**
     * System-job path for the scheduler to flip a PENDING bill past its due date to OVERDUE.
     * Bypasses requireUser/ownership checks since the scheduler isn't acting "as" any particular
     * caller — it's a system job operating over all users' data. Not exposed as a REST endpoint;
     * package-private so it's obviously not meant as a public API surface.
     */
    void markOverdueBySystem(Bill bill) {
        bill.setPaymentStatus("OVERDUE");
        bill.setUpdatedAt(Instant.now());
        billRepository.save(bill);
    }

    public Bill requireOwnedBill(String token, String id) {
        UserAccount user = authService.requireUser(token);
        Bill bill = billRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Bill not found."));
        boolean owns = bill.getUserId() != null && bill.getUserId().equals(user.getId());
        boolean isAdmin = user.getRole() == UserRole.ADMIN;
        if (!owns && !isAdmin) {
            throw new ApiException(HttpStatus.FORBIDDEN, "You do not have access to this bill.");
        }
        return bill;
    }
}
