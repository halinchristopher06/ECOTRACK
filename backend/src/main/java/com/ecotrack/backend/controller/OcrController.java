package com.ecotrack.backend.controller;

import com.ecotrack.backend.dto.MeterReadingResponse;
import com.ecotrack.backend.dto.OcrStatusResponse;
import com.ecotrack.backend.service.AuthService;
import com.ecotrack.backend.service.OcrExtractionService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

/**
 * OCR diagnostics and the standalone meter reader.
 *
 * <p>Both endpoints answer with HTTP 200 even when OCR is unavailable — the payload carries
 * {@code available}/{@code ocrAvailable} plus a {@code reason} instead, so the UI can explain the
 * situation rather than treat it as a hard failure.
 */
@RestController
@RequestMapping("/api/ocr")
public class OcrController {

    private final OcrExtractionService ocrExtractionService;
    private final AuthService authService;

    public OcrController(OcrExtractionService ocrExtractionService, AuthService authService) {
        this.ocrExtractionService = ocrExtractionService;
        this.authService = authService;
    }

    /**
     * Deliberately public: it exposes no user data and must be reachable with a bare
     * {@code curl http://localhost:8080/api/ocr/status} for troubleshooting the Tesseract install.
     */
    @GetMapping("/status")
    public OcrStatusResponse status() {
        return ocrExtractionService.getStatus();
    }

    @PostMapping("/meter")
    public MeterReadingResponse meter(
            @RequestHeader("X-Session-Token") String token,
            @RequestPart("file") MultipartFile file,
            @RequestParam(value = "utilityType", required = false) String utilityType
    ) {
        authService.requireUser(token);
        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            return new MeterReadingResponse(null, null, null, false,
                    "The photo could not be read. Please try again with another image.");
        }
        return ocrExtractionService.readMeter(bytes, utilityType);
    }
}
