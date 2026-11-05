package com.ecotrack.backend.dto;

/**
 * Result of reading a meter photo, returned by {@code POST /api/ocr/meter}.
 *
 * <p>The reading is only ever a genuine OCR result: when OCR is unavailable or the photo cannot be
 * read, {@code reading} is {@code null} and {@code reason} explains why. A number is never invented.
 *
 * @param reading      the suggested numeric reading, or null when nothing could be read
 * @param confidence   mean Tesseract word confidence (0-100), or null when unavailable
 * @param rawText      the raw OCR text, so the user can sanity-check the suggestion
 * @param ocrAvailable whether OCR ran at all
 * @param reason       short human-readable explanation when {@code reading} is null
 */
public record MeterReadingResponse(
        Double reading,
        Integer confidence,
        String rawText,
        boolean ocrAvailable,
        String reason
) {
}
