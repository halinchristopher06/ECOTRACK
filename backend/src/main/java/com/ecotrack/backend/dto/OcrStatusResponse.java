package com.ecotrack.backend.dto;

import java.util.List;

/**
 * Diagnostic snapshot of the OCR subsystem, returned by {@code GET /api/ocr/status} so the
 * frontend can warn the user up-front instead of failing silently mid-upload.
 *
 * @param available    true when a usable Tesseract tessdata directory was found
 * @param tessdataPath the directory actually in use (null when none was found)
 * @param languages    the language files present in that directory (e.g. {@code eng})
 * @param reason       short human-readable explanation when {@code available} is false
 */
public record OcrStatusResponse(
        boolean available,
        String tessdataPath,
        List<String> languages,
        String reason
) {
}
