package com.ecotrack.backend.service;

import com.ecotrack.backend.dto.MeterReadingResponse;
import com.ecotrack.backend.dto.OcrExtractionResult;
import com.ecotrack.backend.dto.OcrStatusResponse;
import jakarta.annotation.PostConstruct;
import net.sourceforge.tess4j.ITessAPI;
import net.sourceforge.tess4j.Tesseract;
import net.sourceforge.tess4j.Word;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import javax.imageio.ImageIO;
import java.awt.Graphics2D;
import java.awt.Rectangle;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.awt.image.WritableRaster;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

/**
 * Extracts raw text from an uploaded bill document and runs best-effort field extraction over it.
 *
 * <p>Two independent engines are involved:
 * <ul>
 *   <li><b>PDFBox</b> — pure Java, always available. Used to pull the text layer out of a digital
 *       PDF. A page with almost no text (a scan) is instead rendered and handed to OCR.</li>
 *   <li><b>Tesseract (via tess4j)</b> — needs the native Tesseract tessdata files on disk. Its
 *       location is resolved once at startup; when it cannot be found, OCR is simply reported as
 *       unavailable and the caller degrades to manual entry.</li>
 * </ul>
 *
 * <p>Failure handling is deliberately never fatal: nothing here throws out to the request, so a
 * broken/unavailable OCR engine can only ever downgrade an upload to "please enter it manually",
 * never break the upload itself.
 */
@Service
public class OcrExtractionService {

    /** Below this, a page's extracted text is treated as "no real text layer" and the page is OCR'd. */
    private static final int MIN_PDF_TEXT_CHARS = 40;
    /** Images whose shorter side is below this are upscaled — Tesseract does far better on bigger text. */
    private static final int MIN_SHORT_SIDE = 1500;
    /** Hard ceiling on a preprocessed image's longest side, to bound memory/time on huge scans. */
    private static final int MAX_IMAGE_SIDE = 4000;
    /** Rendered DPI for scanned PDF pages. */
    private static final float PDF_RENDER_DPI = 300f;
    /** Below this mean word confidence the original (unprocessed) image is OCR'd as a second opinion. */
    private static final double LOW_CONFIDENCE = 65.0;

    private static final Pattern DIGITS = Pattern.compile("\\d+(?:\\.\\d+)?");

    private final BillFieldParser fieldParser = new BillFieldParser();

    private final String configuredTessdataPath;
    private final String language;
    private final int maxPdfPages;
    private final int pageSegMode;

    /** Guards the shared Tesseract instance, which is not thread-safe and is expensive to build. */
    private final Object tesseractLock = new Object();
    private volatile Tesseract tesseract;

    /** Resolved at startup; null when no usable tessdata directory could be found. */
    private volatile String resolvedTessdataPath;
    private volatile List<String> availableLanguages = List.of();
    private volatile String unavailableReason;

    public OcrExtractionService(
            @Value("${app.ocr.tessdata-path:}") String configuredTessdataPath,
            @Value("${app.ocr.language:eng}") String language,
            @Value("${app.ocr.max-pdf-pages:10}") int maxPdfPages,
            @Value("${app.ocr.psm:6}") int pageSegMode
    ) {
        this.configuredTessdataPath = configuredTessdataPath;
        this.language = StringUtils.hasText(language) ? language.trim() : "eng";
        this.maxPdfPages = Math.max(1, maxPdfPages);
        this.pageSegMode = Math.min(13, Math.max(0, pageSegMode));
    }

    /**
     * Startup self-check. Resolves the tessdata directory and reports what it found. Wrapped in a
     * catch-all on purpose: a misconfigured OCR install must never stop the application booting.
     */
    @PostConstruct
    public void init() {
        try {
            String resolved = resolveTessdataPath();
            if (resolved == null) {
                unavailableReason = "Tesseract tessdata for '" + language + ".traineddata' was not found. Looked in: "
                        + String.join(" | ", tessdataCandidates())
                        + ". Fix: install Tesseract, or set app.ocr.tessdata-path to the folder that contains "
                        + language + ".traineddata (e.g. C:/Program Files/Tesseract-OCR/tessdata).";
                System.err.println("OCR self-check: " + unavailableReason);
                return;
            }
            resolvedTessdataPath = resolved;
            availableLanguages = listLanguages(resolved);
            unavailableReason = null;
            System.out.println("OCR self-check: available. tessdataPath=" + resolved
                    + ", languages=" + availableLanguages
                    + ", psm=" + pageSegMode
                    + ", maxPdfPages=" + maxPdfPages + ".");
        } catch (Throwable t) {
            unavailableReason = "OCR self-check failed (" + t.getClass().getName() + "): " + safeMessage(t);
            System.err.println("OCR self-check: " + unavailableReason);
        }
    }

    /** Snapshot for {@code GET /api/ocr/status}. */
    public OcrStatusResponse getStatus() {
        boolean available = resolvedTessdataPath != null;
        return new OcrStatusResponse(
                available,
                resolvedTessdataPath,
                availableLanguages,
                available ? null : unavailableReason);
    }

    public boolean isAvailable() {
        return resolvedTessdataPath != null;
    }

    // ----------------------------------------------------------------- bills

    /**
     * Best-effort extraction for an uploaded bill. Never throws: on any failure the result simply
     * carries {@code ocrAvailable=false} plus a {@code reason}, and the caller keeps its manual fallback.
     *
     * @param utilityType "ELECTRICITY" or "WATER" (nullable) — selects the right unit patterns
     */
    public OcrExtractionResult extract(File file, String extension, String utilityType) {
        OcrExtractionResult result = new OcrExtractionResult();
        try {
            String ext = extension == null ? "" : extension.toLowerCase(Locale.ROOT);
            TextOutcome outcome = "pdf".equals(ext) ? extractPdf(file) : extractImageFile(file);

            result.setExtractionMethod(outcome.method != null ? outcome.method : "NONE");
            result.setConfidence(outcome.confidence);

            if (outcome.text == null || outcome.text.isBlank()) {
                result.setOcrAvailable(false);
                result.setReason(outcome.reason != null ? outcome.reason : "No text could be extracted.");
                return result;
            }

            result.setOcrAvailable(true);
            result.setRawText(outcome.text);
            applyFields(result, outcome.text, utilityType);
            return result;
        } catch (Throwable t) {
            logOcrFailure("bill extraction", t);
            result.setOcrAvailable(false);
            result.setExtractionMethod("NONE");
            result.setReason("Extraction failed (" + t.getClass().getSimpleName() + "). You can still enter the bill manually.");
            return result;
        }
    }

    private void applyFields(OcrExtractionResult result, String text, String utilityType) {
        BillFieldParser.Fields fields = fieldParser.parse(text, utilityType);
        result.setExtractedAmount(fields.getAmount());
        result.setExtractedUnits(fields.getUnits());
        result.setExtractedIssueDate(fields.getIssueDate());
        result.setExtractedDueDate(fields.getDueDate());
        result.setExtractedBillingPeriod(fields.getBillingPeriod());
        result.setExtractedBillingPeriodStart(fields.getBillingPeriodStart());
        result.setExtractedBillingPeriodEnd(fields.getBillingPeriodEnd());
        result.setExtractedPreviousReading(fields.getPreviousReading());
        result.setExtractedCurrentReading(fields.getCurrentReading());
        result.setExtractedConsumerNumber(fields.getConsumerNumber());
        result.setFieldsFound(fields.getFieldsFound());
    }

    // -------------------------------------------------------------- meter

    /**
     * Reads a meter display from a photo. The returned reading is only ever a real OCR result — when
     * OCR is unavailable or nothing readable was found, {@code reading} is null and {@code reason}
     * explains why, so the UI never fills in an invented number.
     */
    public MeterReadingResponse readMeter(byte[] imageBytes, String utilityType) {
        try {
            if (!isAvailable()) {
                return new MeterReadingResponse(null, null, null, false, unavailableReason);
            }
            BufferedImage decoded = decodeImage(imageBytes);
            if (decoded == null) {
                return new MeterReadingResponse(null, null, null, false,
                        "That photo could not be read as an image. Try a JPG or PNG straight from the camera.");
            }

            TextOutcome outcome = ocrBufferedImage(decoded, true, "OCR_IMAGE");
            if (outcome.text == null || outcome.text.isBlank()) {
                return new MeterReadingResponse(null, null, null, true,
                        outcome.reason != null ? outcome.reason
                                : "No digits were found in the photo. Move closer and keep the display in focus.");
            }

            Double reading = largestNumber(outcome.text);
            if (reading == null) {
                return new MeterReadingResponse(null, outcome.confidence, outcome.text, true,
                        "The photo was read but no meter digits were recognised — please enter the reading manually.");
            }
            return new MeterReadingResponse(reading, outcome.confidence, outcome.text, true, null);
        } catch (Throwable t) {
            logOcrFailure("meter OCR", t);
            return new MeterReadingResponse(null, null, null, false,
                    "Meter reading failed (" + t.getClass().getSimpleName() + "). Please enter the reading manually.");
        }
    }

    // ---------------------------------------------------------------- PDF

    private TextOutcome extractPdf(File file) {
        try (PDDocument document = Loader.loadPDF(file)) {
            int totalPages = document.getNumberOfPages();
            if (totalPages <= 0) {
                return TextOutcome.none("The PDF has no pages.");
            }
            if (totalPages > maxPdfPages) {
                System.out.println("Notice: PDF has " + totalPages + " pages; processing the first " + maxPdfPages + " only.");
            }
            int pagesToProcess = Math.min(totalPages, maxPdfPages);

            StringBuilder merged = new StringBuilder();
            boolean usedOcr = false;
            long confidenceSum = 0;
            int confidenceCount = 0;
            PDFRenderer renderer = null;

            for (int page = 1; page <= pagesToProcess; page++) {
                String pageText = textOfPage(document, page);
                if (nonWhitespaceCount(pageText) >= MIN_PDF_TEXT_CHARS) {
                    merged.append(pageText).append('\n');
                    continue;
                }

                // Fewer than ~40 real characters means there is no usable text layer — a scan.
                if (!isAvailable()) {
                    if (StringUtils.hasText(pageText)) {
                        merged.append(pageText).append('\n');
                    }
                    continue;
                }
                if (renderer == null) {
                    renderer = new PDFRenderer(document);
                }
                TextOutcome ocrOutcome = ocrRenderedPage(renderer, page);
                if (ocrOutcome.text == null || ocrOutcome.text.isBlank()) {
                    // Keep whatever little text PDFBox did find so nothing is silently dropped.
                    if (StringUtils.hasText(pageText)) {
                        merged.append(pageText).append('\n');
                    }
                    continue;
                }
                merged.append(ocrOutcome.text).append('\n');
                usedOcr = true;
                if (ocrOutcome.confidence != null) {
                    confidenceSum += ocrOutcome.confidence;
                    confidenceCount++;
                }
            }

            String text = merged.toString().trim();
            if (text.isEmpty()) {
                if (!isAvailable()) {
                    return TextOutcome.none(unavailableReason
                            + " This PDF has no text layer, so it needs OCR to be readable.");
                }
                return TextOutcome.none("No text could be extracted from the PDF — it may be blank or corrupt.");
            }

            TextOutcome outcome = new TextOutcome();
            outcome.text = text;
            outcome.method = usedOcr ? "OCR_SCANNED_PDF" : "PDF_TEXT";
            outcome.confidence = confidenceCount > 0 ? (int) Math.round((double) confidenceSum / confidenceCount) : null;
            return outcome;
        } catch (Throwable t) {
            logOcrFailure("PDF text extraction", t);
            return TextOutcome.none("The PDF could not be read (" + t.getClass().getSimpleName() + ").");
        }
    }

    private String textOfPage(PDDocument document, int pageNumber) throws IOException {
        PDFTextStripper stripper = new PDFTextStripper();
        stripper.setStartPage(pageNumber);
        stripper.setEndPage(pageNumber);
        return stripper.getText(document);
    }

    private TextOutcome ocrRenderedPage(PDFRenderer renderer, int pageNumber) {
        try {
            BufferedImage rendered = renderer.renderImageWithDPI(pageNumber - 1, PDF_RENDER_DPI);
            return ocrBufferedImage(rendered, false, "OCR_SCANNED_PDF");
        } catch (Throwable t) {
            logOcrFailure("PDF page rendering (page " + pageNumber + ")", t);
            return TextOutcome.none("Page " + pageNumber + " could not be rendered for OCR ("
                    + t.getClass().getSimpleName() + ").");
        }
    }

    // -------------------------------------------------------------- images

    private TextOutcome extractImageFile(File file) {
        if (!isAvailable()) {
            return TextOutcome.none(unavailableReason);
        }
        byte[] bytes;
        try {
            bytes = Files.readAllBytes(file.toPath());
        } catch (IOException e) {
            logOcrFailure("reading uploaded image", e);
            return TextOutcome.none("The uploaded file could not be read (" + e.getClass().getSimpleName() + ").");
        }
        BufferedImage decoded = decodeImage(bytes);
        if (decoded == null) {
            return TextOutcome.none("The file could not be decoded as an image. Try a JPG or PNG.");
        }
        return ocrBufferedImage(decoded, false, "OCR_IMAGE");
    }

    /** Decodes image bytes and applies any embedded JPEG EXIF rotation, so sideways photos still read. */
    private BufferedImage decodeImage(byte[] bytes) {
        if (bytes == null || bytes.length == 0) {
            return null;
        }
        try (InputStream in = new ByteArrayInputStream(bytes)) {
            BufferedImage decoded = ImageIO.read(in);
            if (decoded == null) {
                return null;
            }
            return applyExifOrientation(decoded, readExifOrientation(bytes));
        } catch (Throwable t) {
            logOcrFailure("image decoding", t);
            return null;
        }
    }

    /**
     * Preprocesses an image and OCRs it. If the first pass reads with low confidence, the untouched
     * original is OCR'd too and the better of the two results is kept — preprocessing helps far more
     * often than it hurts, but on an already-clean image it can occasionally hurt.
     */
    private TextOutcome ocrBufferedImage(BufferedImage source, boolean digitsOnly, String method) {
        if (!isAvailable()) {
            return TextOutcome.none(unavailableReason);
        }
        OcrOutcome primary = ocr(preprocess(source), digitsOnly);
        OcrOutcome fallback = null;
        if (primary == null || !primary.hasText() || primary.confidence < LOW_CONFIDENCE) {
            fallback = ocr(source, digitsOnly);
        }
        OcrOutcome best = pickBetter(primary, fallback);

        if (best == null || !best.hasText()) {
            String reason = best != null && best.error != null
                    ? best.error
                    : "No readable text was found in the image.";
            return TextOutcome.none(reason);
        }

        TextOutcome outcome = new TextOutcome();
        outcome.text = best.text;
        outcome.method = method;
        outcome.confidence = (int) Math.round(best.confidence);
        return outcome;
    }

    /** Runs Tesseract over one image. Never throws; a failure comes back as an {@link OcrOutcome#error}. */
    private OcrOutcome ocr(BufferedImage image, boolean digitsOnly) {
        synchronized (tesseractLock) {
            try {
                Tesseract engine = sharedTesseract();
                // A blank whitelist means "no restriction" — restore it for the full-alphabet passes.
                engine.setTessVariable("tessedit_char_whitelist", digitsOnly ? "0123456789." : "");
                List<Word> words = engine.getWords(image, ITessAPI.TessPageIteratorLevel.RIL_WORD);
                return buildOutcome(words);
            } catch (Throwable t) {
                logOcrFailure("image OCR", t);
                // Drop a possibly half-initialised engine so a later call can retry cleanly.
                tesseract = null;
                OcrOutcome failed = new OcrOutcome();
                failed.error = "The OCR engine failed (" + t.getClass().getSimpleName() + "): " + safeMessage(t);
                return failed;
            }
        }
    }

    /** Reconstructs line-broken text from Tesseract's per-word output and averages the confidences. */
    private static OcrOutcome buildOutcome(List<Word> words) {
        OcrOutcome outcome = new OcrOutcome();
        if (words == null || words.isEmpty()) {
            outcome.text = "";
            outcome.confidence = 0;
            return outcome;
        }

        StringBuilder text = new StringBuilder();
        double confidenceSum = 0;
        int confidenceCount = 0;
        Rectangle previousBox = null;

        for (Word word : words) {
            String token = word.getText();
            if (token == null || token.isBlank()) {
                continue;
            }
            Rectangle box = word.getBoundingBox();
            if (previousBox != null && box != null) {
                int previousCentre = previousBox.y + previousBox.height / 2;
                int centre = box.y + box.height / 2;
                boolean newLine = Math.abs(centre - previousCentre) > Math.max(4, previousBox.height / 2);
                text.append(newLine ? '\n' : ' ');
            }
            text.append(token.trim());
            if (box != null) {
                previousBox = box;
            }
            float confidence = word.getConfidence();
            if (confidence >= 0) {
                confidenceSum += confidence;
                confidenceCount++;
            }
        }

        outcome.text = text.toString();
        outcome.confidence = confidenceCount > 0 ? confidenceSum / confidenceCount : 0;
        return outcome;
    }

    private static OcrOutcome pickBetter(OcrOutcome first, OcrOutcome second) {
        OcrOutcome best = null;
        for (OcrOutcome candidate : new OcrOutcome[]{first, second}) {
            if (candidate == null) {
                continue;
            }
            if (best == null) {
                best = candidate;
                continue;
            }
            if (candidate.hasText() && !best.hasText()) {
                best = candidate;
            } else if (candidate.hasText() == best.hasText() && candidate.confidence > best.confidence) {
                best = candidate;
            }
        }
        return best;
    }

    /** Builds the Tesseract engine once and reuses it. Call only while holding {@link #tesseractLock}. */
    private Tesseract sharedTesseract() {
        if (tesseract == null) {
            Tesseract created = new Tesseract();
            if (resolvedTessdataPath != null) {
                created.setDatapath(resolvedTessdataPath);
            }
            created.setLanguage(language);
            created.setPageSegMode(pageSegMode);
            tesseract = created;
        }
        return tesseract;
    }

    // -------------------------------------------------------- preprocessing

    /** Grayscale + upscale + contrast stretch + Otsu binarisation + a light median denoise, in place. */
    private static BufferedImage preprocess(BufferedImage source) {
        BufferedImage gray = toScaledGrayscale(source);
        stretchContrast(gray);
        binarise(gray, otsuThreshold(gray));
        medianDenoise(gray);
        return gray;
    }

    private static BufferedImage toScaledGrayscale(BufferedImage source) {
        int width = source.getWidth();
        int height = source.getHeight();
        if (width <= 0 || height <= 0) {
            return source;
        }

        double scale = 1.0;
        int shorter = Math.min(width, height);
        if (shorter < MIN_SHORT_SIDE) {
            scale = (double) MIN_SHORT_SIDE / shorter;
        }
        int targetWidth = (int) Math.round(width * scale);
        int targetHeight = (int) Math.round(height * scale);

        // Never let the upscale blow past the memory ceiling.
        int longest = Math.max(targetWidth, targetHeight);
        if (longest > MAX_IMAGE_SIDE) {
            double shrink = (double) MAX_IMAGE_SIDE / longest;
            targetWidth = Math.max(1, (int) Math.round(targetWidth * shrink));
            targetHeight = Math.max(1, (int) Math.round(targetHeight * shrink));
        }

        // Drawing into a TYPE_BYTE_GRAY surface performs the colour → luminance conversion for us.
        BufferedImage gray = new BufferedImage(targetWidth, targetHeight, BufferedImage.TYPE_BYTE_GRAY);
        Graphics2D graphics = gray.createGraphics();
        try {
            graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            graphics.drawImage(source, 0, 0, targetWidth, targetHeight, null);
        } finally {
            graphics.dispose();
        }
        return gray;
    }

    /** Histogram-based contrast stretch using the 1st/99th percentiles, so stray pixels can't skew it. */
    private static void stretchContrast(BufferedImage gray) {
        int width = gray.getWidth();
        int height = gray.getHeight();
        int total = width * height;
        if (total == 0) {
            return;
        }

        int[] histogram = new int[256];
        WritableRaster raster = gray.getRaster();
        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                histogram[raster.getSample(x, y, 0)]++;
            }
        }

        int clip = Math.max(1, total / 100);
        int low = 0;
        for (int accumulated = 0; low < 255; low++) {
            accumulated += histogram[low];
            if (accumulated > clip) {
                break;
            }
        }
        int high = 255;
        for (int accumulated = 0; high > 0; high--) {
            accumulated += histogram[high];
            if (accumulated > clip) {
                break;
            }
        }
        if (high <= low) {
            return;
        }

        double scale = 255.0 / (high - low);
        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                int value = raster.getSample(x, y, 0);
                int stretched = (int) Math.round((value - low) * scale);
                raster.setSample(x, y, 0, Math.max(0, Math.min(255, stretched)));
            }
        }
    }

    /** Classic Otsu threshold: the value that best separates the histogram into two classes. */
    private static int otsuThreshold(BufferedImage gray) {
        int width = gray.getWidth();
        int height = gray.getHeight();
        int total = width * height;
        if (total == 0) {
            return 127;
        }

        int[] histogram = new int[256];
        WritableRaster raster = gray.getRaster();
        long sum = 0;
        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                int value = raster.getSample(x, y, 0);
                histogram[value]++;
                sum += value;
            }
        }

        long sumBackground = 0;
        int weightBackground = 0;
        double bestVariance = -1;
        int threshold = 127;
        for (int level = 0; level < 256; level++) {
            weightBackground += histogram[level];
            if (weightBackground == 0) {
                continue;
            }
            int weightForeground = total - weightBackground;
            if (weightForeground == 0) {
                break;
            }
            sumBackground += (long) level * histogram[level];
            double meanBackground = (double) sumBackground / weightBackground;
            double meanForeground = (double) (sum - sumBackground) / weightForeground;
            double between = (double) weightBackground * weightForeground
                    * (meanBackground - meanForeground) * (meanBackground - meanForeground);
            if (between > bestVariance) {
                bestVariance = between;
                threshold = level;
            }
        }
        return threshold;
    }

    private static void binarise(BufferedImage gray, int threshold) {
        int width = gray.getWidth();
        int height = gray.getHeight();
        WritableRaster raster = gray.getRaster();
        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                int value = raster.getSample(x, y, 0);
                raster.setSample(x, y, 0, value > threshold ? 255 : 0);
            }
        }
    }

    /** 3x3 median filter — removes salt-and-pepper speckle without smearing digit edges. */
    private static void medianDenoise(BufferedImage gray) {
        int width = gray.getWidth();
        int height = gray.getHeight();
        if (width < 3 || height < 3) {
            return;
        }

        byte[] source = new byte[width * height];
        gray.getRaster().getDataElements(0, 0, width, height, source);
        byte[] result = new byte[source.length];
        int[] window = new int[9];

        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                if (x == 0 || y == 0 || x == width - 1 || y == height - 1) {
                    result[y * width + x] = source[y * width + x];
                    continue;
                }
                int index = 0;
                for (int dy = -1; dy <= 1; dy++) {
                    for (int dx = -1; dx <= 1; dx++) {
                        window[index++] = source[(y + dy) * width + (x + dx)] & 0xFF;
                    }
                }
                window[0] = median9(window);
                result[y * width + x] = (byte) window[0];
            }
        }
        gray.getRaster().setDataElements(0, 0, width, height, result);
    }

    /** Sorts the 9-entry window in place and returns the middle value. */
    private static int median9(int[] values) {
        for (int i = 1; i < 9; i++) {
            int key = values[i];
            int j = i - 1;
            while (j >= 0 && values[j] > key) {
                values[j + 1] = values[j];
                j--;
            }
            values[j + 1] = key;
        }
        return values[4];
    }

    // ----------------------------------------------------------- EXIF rotate

    /** Reads the EXIF orientation (1-8) from JPEG bytes; returns 1 when absent or unparseable. */
    static int readExifOrientation(byte[] data) {
        if (data == null || data.length < 4 || (data[0] & 0xFF) != 0xFF || (data[1] & 0xFF) != 0xD8) {
            return 1; // not a JPEG
        }
        int position = 2;
        while (position + 4 <= data.length) {
            if ((data[position] & 0xFF) != 0xFF) {
                position++;
                continue;
            }
            int marker = data[position + 1] & 0xFF;
            if (marker == 0xFF) {
                position++;
                continue;
            }
            // Standalone markers carry no length payload.
            if (marker == 0x01 || (marker >= 0xD0 && marker <= 0xD8)) {
                position += 2;
                continue;
            }
            if (marker == 0xD9 || marker == 0xDA) {
                break; // end of header / start of scan data
            }
            int segmentLength = ((data[position + 2] & 0xFF) << 8) | (data[position + 3] & 0xFF);
            if (segmentLength < 2 || position + 2 + segmentLength > data.length) {
                break;
            }
            if (marker == 0xE1) {
                int orientation = parseExifOrientation(data, position + 4, segmentLength - 2);
                if (orientation >= 1 && orientation <= 8) {
                    return orientation;
                }
            }
            position += 2 + segmentLength;
        }
        return 1;
    }

    private static int parseExifOrientation(byte[] data, int offset, int length) {
        if (length < 14 || offset + 14 > data.length) {
            return -1;
        }
        // The APP1 payload must begin with the "Exif\0\0" identifier.
        if (!(data[offset] == 'E' && data[offset + 1] == 'x' && data[offset + 2] == 'i'
                && data[offset + 3] == 'f' && data[offset + 4] == 0 && data[offset + 5] == 0)) {
            return -1;
        }
        int tiff = offset + 6;
        boolean littleEndian;
        if (data[tiff] == 'I' && data[tiff + 1] == 'I') {
            littleEndian = true;
        } else if (data[tiff] == 'M' && data[tiff + 1] == 'M') {
            littleEndian = false;
        } else {
            return -1;
        }
        if (readUnsignedShort(data, tiff + 2, littleEndian) != 0x002A) {
            return -1;
        }
        int ifdOffset = readInt(data, tiff + 4, littleEndian);
        int ifd = tiff + ifdOffset;
        if (ifd < 0 || ifd + 2 > data.length) {
            return -1;
        }
        int entries = readUnsignedShort(data, ifd, littleEndian);
        for (int i = 0; i < entries; i++) {
            int entry = ifd + 2 + i * 12;
            if (entry + 12 > data.length) {
                return -1;
            }
            if (readUnsignedShort(data, entry, littleEndian) == 0x0112) {
                return readUnsignedShort(data, entry + 8, littleEndian);
            }
        }
        return -1;
    }

    private static int readUnsignedShort(byte[] data, int index, boolean littleEndian) {
        if (index + 2 > data.length) {
            return 0;
        }
        int first = data[index] & 0xFF;
        int second = data[index + 1] & 0xFF;
        return littleEndian ? (first | (second << 8)) : ((first << 8) | second);
    }

    private static int readInt(byte[] data, int index, boolean littleEndian) {
        if (index + 4 > data.length) {
            return 0;
        }
        int b0 = data[index] & 0xFF;
        int b1 = data[index + 1] & 0xFF;
        int b2 = data[index + 2] & 0xFF;
        int b3 = data[index + 3] & 0xFF;
        return littleEndian
                ? (b0 | (b1 << 8) | (b2 << 16) | (b3 << 24))
                : ((b0 << 24) | (b1 << 16) | (b2 << 8) | b3);
    }

    /**
     * Reorients an image per its EXIF orientation tag using an explicit destination→source pixel map
     * (unambiguous, and avoids the transform-concatenation-order pitfalls of AffineTransform).
     */
    static BufferedImage applyExifOrientation(BufferedImage source, int orientation) {
        if (orientation <= 1 || orientation > 8) {
            return source;
        }
        int width = source.getWidth();
        int height = source.getHeight();
        boolean swapDimensions = orientation >= 5;
        int targetWidth = swapDimensions ? height : width;
        int targetHeight = swapDimensions ? width : height;
        BufferedImage output = new BufferedImage(targetWidth, targetHeight, BufferedImage.TYPE_INT_RGB);

        for (int y = 0; y < targetHeight; y++) {
            for (int x = 0; x < targetWidth; x++) {
                int sourceX = x;
                int sourceY = y;
                switch (orientation) {
                    case 2 -> { sourceX = width - 1 - x; sourceY = y; }
                    case 3 -> { sourceX = width - 1 - x; sourceY = height - 1 - y; }
                    case 4 -> { sourceX = x; sourceY = height - 1 - y; }
                    case 5 -> { sourceX = y; sourceY = x; }
                    case 6 -> { sourceX = y; sourceY = height - 1 - x; }
                    case 7 -> { sourceX = width - 1 - y; sourceY = height - 1 - x; }
                    case 8 -> { sourceX = width - 1 - y; sourceY = x; }
                    default -> { sourceX = x; sourceY = y; }
                }
                output.setRGB(x, y, source.getRGB(sourceX, sourceY));
            }
        }
        return output;
    }

    // ------------------------------------------------------------ tessdata

    /**
     * Resolves the tessdata directory in the documented order: explicit property, TESSDATA_PREFIX,
     * then the common install locations. Returns null when none of them contains the language file.
     */
    private String resolveTessdataPath() {
        for (String candidate : tessdataCandidates()) {
            if (!StringUtils.hasText(candidate)) {
                continue;
            }
            Path directory = Paths.get(candidate.trim());
            if (Files.isDirectory(directory) && Files.isRegularFile(directory.resolve(language + ".traineddata"))) {
                return directory.toAbsolutePath().normalize().toString();
            }
        }
        return null;
    }

    /** Ordered list of places tessdata might live. Used for resolution and for the error message. */
    private List<String> tessdataCandidates() {
        List<String> candidates = new ArrayList<>();
        if (StringUtils.hasText(configuredTessdataPath)) {
            candidates.add(configuredTessdataPath.trim());
        }
        String prefix = System.getenv("TESSDATA_PREFIX");
        if (StringUtils.hasText(prefix)) {
            candidates.add(prefix.trim());
            candidates.add(Paths.get(prefix.trim(), "tessdata").toString());
        }
        candidates.add("C:/Program Files/Tesseract-OCR/tessdata");
        candidates.add("C:/Program Files (x86)/Tesseract-OCR/tessdata");
        candidates.add("/usr/share/tesseract-ocr/5/tessdata");
        candidates.add("/usr/share/tesseract-ocr/4.00/tessdata");
        candidates.add("/usr/share/tessdata");
        candidates.add("/opt/homebrew/share/tessdata");
        candidates.add("/usr/local/share/tessdata");
        return candidates;
    }

    private static List<String> listLanguages(String directory) {
        try (Stream<Path> files = Files.list(Paths.get(directory))) {
            return files
                    .map(path -> path.getFileName().toString())
                    .filter(name -> name.endsWith(".traineddata"))
                    .map(name -> name.substring(0, name.length() - ".traineddata".length()))
                    .sorted()
                    .toList();
        } catch (IOException e) {
            return List.of();
        }
    }

    // ------------------------------------------------------------- helpers

    /** The longest digit run in the text — for a meter display that is the reading itself. */
    private static Double largestNumber(String text) {
        Matcher matcher = DIGITS.matcher(text);
        String best = null;
        while (matcher.find()) {
            String token = matcher.group();
            if (best == null || digitCount(token) > digitCount(best)) {
                best = token;
            }
        }
        if (best == null) {
            return null;
        }
        try {
            return Double.parseDouble(best);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static int digitCount(String token) {
        int count = 0;
        for (int i = 0; i < token.length(); i++) {
            if (Character.isDigit(token.charAt(i))) {
                count++;
            }
        }
        return count;
    }

    private static int nonWhitespaceCount(String text) {
        if (text == null) {
            return 0;
        }
        int count = 0;
        for (int i = 0; i < text.length(); i++) {
            if (!Character.isWhitespace(text.charAt(i))) {
                count++;
            }
        }
        return count;
    }

    /** Logs the REAL exception class and message — the previous generic message hid the actual cause. */
    private static void logOcrFailure(String stage, Throwable failure) {
        System.err.println("OCR failure during " + stage + ": "
                + failure.getClass().getName() + " - " + safeMessage(failure));
    }

    private static String safeMessage(Throwable failure) {
        String message = failure.getMessage();
        return message != null && !message.isBlank() ? message : "(no message)";
    }

    /** Outcome of a text-extraction attempt: either real text, or a reason why there is none. */
    private static final class TextOutcome {
        private String text;
        private String method;
        private Integer confidence;
        private String reason;

        static TextOutcome none(String reason) {
            TextOutcome outcome = new TextOutcome();
            outcome.method = "NONE";
            outcome.reason = reason;
            return outcome;
        }
    }

    /** Raw result of one Tesseract pass over one image. */
    private static final class OcrOutcome {
        private String text;
        private double confidence;
        private String error;

        boolean hasText() {
            return text != null && !text.isBlank();
        }
    }
}
