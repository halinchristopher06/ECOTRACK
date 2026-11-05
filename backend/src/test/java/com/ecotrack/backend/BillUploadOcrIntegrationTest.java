package com.ecotrack.backend;

import com.ecotrack.backend.dto.LoginRequest;
import com.ecotrack.backend.dto.OcrExtractionResult;
import com.ecotrack.backend.service.AuthService;
import com.ecotrack.backend.service.OcrExtractionService;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * End-to-end check of {@code POST /api/bills/upload}: a generated bill image goes in, and the amount
 * and units come back out of the parser.
 *
 * <p>Skipped (not failed) when Tesseract is unavailable, so the suite still passes on a machine
 * without OCR installed — exactly the graceful degradation the feature is designed around.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class BillUploadOcrIntegrationTest {

    private static final String BILL_LINE_1 = "Total Amount Payable Rs. 1,245.00";
    private static final String BILL_LINE_2 = "Units 312 kWh";
    private static final String BILL_LINE_3 = "Due Date 15/11/2026";

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private OcrExtractionService ocrExtractionService;

    @Autowired
    private AuthService authService;

    @Test
    @DisplayName("Uploading a generated bill image extracts the payable amount and the kWh units")
    void uploadExtractsAmountAndUnitsFromGeneratedBillImage() throws Exception {
        Assumptions.assumeTrue(ocrExtractionService.isAvailable(),
                "Tesseract OCR is unavailable on this machine — skipping the OCR upload integration test.");

        String token = authService.login(new LoginRequest("admin@ecotrack.com", "Admin@123")).token();
        byte[] png = renderBillImage();

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("file", namedResource(png, "generated-bill.png"));
        body.add("utilityType", "ELECTRICITY");

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);
        headers.set("X-Session-Token", token);

        ResponseEntity<OcrExtractionResult> response = restTemplate.postForEntity(
                "/api/bills/upload", new HttpEntity<>(body, headers), OcrExtractionResult.class);

        assertEquals(HttpStatus.OK, response.getStatusCode(), "the upload must never fail, even if OCR does");
        OcrExtractionResult result = response.getBody();
        assertNotNull(result, "the endpoint must return an extraction result");

        assertTrue(result.isOcrAvailable(), "OCR should have produced text for a clean generated image");
        assertEquals("OCR_IMAGE", result.getExtractionMethod());

        assertNotNull(result.getExtractedAmount(), "the payable amount should have been extracted");
        assertEquals(1245.00, result.getExtractedAmount(), 2.0);

        assertNotNull(result.getExtractedUnits(), "the consumed units should have been extracted");
        assertEquals(312, result.getExtractedUnits(), 1.0);

        assertEquals("2026-11-15", result.getExtractedDueDate());
    }

    /** Renders the three bill lines to a clean black-on-white PNG, sized for reliable OCR. */
    private static byte[] renderBillImage() throws Exception {
        BufferedImage image = new BufferedImage(2000, 600, BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = image.createGraphics();
        try {
            graphics.setColor(Color.WHITE);
            graphics.fillRect(0, 0, image.getWidth(), image.getHeight());
            graphics.setColor(Color.BLACK);
            graphics.setFont(new Font(Font.SANS_SERIF, Font.PLAIN, 60));
            graphics.drawString(BILL_LINE_1, 40, 150);
            graphics.drawString(BILL_LINE_2, 40, 320);
            graphics.drawString(BILL_LINE_3, 40, 490);
        } finally {
            graphics.dispose();
        }

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(image, "png", out);
        return out.toByteArray();
    }

    /** Multipart parts need a filename, otherwise Spring treats the part as a plain form field. */
    private static ByteArrayResource namedResource(byte[] bytes, String filename) {
        return new ByteArrayResource(bytes) {
            @Override
            public String getFilename() {
                return filename;
            }
        };
    }
}
