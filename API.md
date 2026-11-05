# EcoTrack API reference

Base URL for auth endpoints: `http://localhost:8080/api/auth`. All other groups are under
`http://localhost:8080/api/...` directly (not under `/auth`). Authenticated endpoints require an
`X-Session-Token` header obtained from `POST /api/auth/login`.

This is a concise reference of endpoint groups, not exhaustive per-field documentation — see the
corresponding `*Controller.java`/`*Request`/`*Response` classes in
`backend/src/main/java/com/ecotrack/backend/` for exact request/response shapes.

## Auth (`/api/auth`)

- `POST /signup`, `POST /verify-otp`, `POST /resend-otp`
- `POST /login/send-otp`, `POST /login/verify-otp`, `POST /login`
- `GET /profile`, `PUT /profile`
- `POST /forgot-password`, `POST /reset-password`
- `GET /admin/users`, `GET /admin/users/{userId}/history`, `GET /admin/stats` (admin only)

## Bills (`/api/bills`)

- `POST /upload` — multipart: the file part is `file`; the optional form field `utilityType`
  (`ELECTRICITY`/`WATER`) selects the electricity vs water unit patterns. Returns an
  `OcrExtractionResult` (see below).
- `POST ` (create), `GET ` (list, filterable by `utilityType`/`paymentStatus`/`billingMonth`),
  `GET /{id}`, `PUT /{id}`, `DELETE /{id}`, `PUT /{id}/mark-paid`,
  `GET /{id}/document` (download)

### `POST /api/bills/upload` response (`OcrExtractionResult`)

Existing fields are unchanged; the OCR rework only **adds** fields:

| Field | Notes |
| --- | --- |
| `ocrAvailable` | `true` only when text was actually obtained. |
| `rawText` | Extracted text (unchanged). |
| `extractedAmount`, `extractedUnits`, `extractedIssueDate`, `extractedDueDate`, `extractedBillingPeriod` | Existing fields; still populated. |
| `documentPath`, `documentOriginalName` | Existing fields; still populated. |
| `extractionMethod` | `PDF_TEXT` \| `OCR_IMAGE` \| `OCR_SCANNED_PDF` \| `NONE`. |
| `confidence` | Mean Tesseract word confidence, 0–100. `null` for pure PDF-text extraction. |
| `reason` | Short human-readable explanation when `ocrAvailable` is `false`. |
| `extractedPreviousReading`, `extractedCurrentReading` | Meter readings, when printed. |
| `extractedBillingPeriodStart`, `extractedBillingPeriodEnd` | ISO `yyyy-MM-dd`. |
| `extractedConsumerNumber` | Consumer/account number, when present. |
| `fieldsFound` | Names of the fields the parser identified, so the UI can flag what's missing. |

OCR never fails the request: on any OCR/text error the response is still HTTP 200 with
`ocrAvailable: false` and a `reason`, and the client falls back to manual entry.

## OCR (`/api/ocr`)

- `GET /status` — **public** (no token). Returns:

  ```json
  { "available": true, "tessdataPath": "C:\\Program Files\\Tesseract-OCR\\tessdata",
    "languages": ["eng", "osd"], "reason": null }
  ```

  When unavailable, `reason` explains why (see the README troubleshooting table). Useful for
  checking the Tesseract install from `curl`.

- `POST /meter` — multipart: file part `file`, optional `utilityType`. Requires `X-Session-Token`.
  Preprocesses the image and runs Tesseract with a digits-only whitelist. Returns:

  ```json
  { "reading": 12345, "confidence": 88, "rawText": "12345", "ocrAvailable": true, "reason": null }
  ```

  A number is never invented: if OCR is unavailable or no digits are found, `reading` is `null`
  and `reason` explains why.

## Appliances (`/api/appliances`)

- `POST `, `GET `, `GET /breakdown` (cost breakdown + tips), `GET /{id}`, `PUT /{id}`,
  `DELETE /{id}`

## Tariffs (`/api/tariffs` and admin-only management)

- Public tariff catalog read endpoints plus admin create/update endpoints
  (`TariffAdminController`) for managing electricity/water tariff slabs.

## Budget (`/api/budget`)

- `GET ` (get or create default), `PUT ` (update budgets/thresholds), `GET /status`

## Predictions (`/api/predictions`)

- Upcoming bill amount prediction based on billing history.

## Dashboard (`/api/dashboard`)

- Aggregated summary (expenses, pending payments) and chart data for the main dashboard.

## Anomaly detection (`/api/anomaly`)

- Unusual-consumption checks against recent billing history.

## Recommendations (`/api/recommendations`)

- `GET ` (active recommendations), `PUT /{id}/completed`

## Notifications (`/api/notifications`)

- `GET ` (list), `PUT /{id}/read`, `GET /preferences`, `PUT /preferences`

## Admin (`/api/auth/admin`, `/api/admin`)

- `GET /api/auth/admin/users`, `GET /api/auth/admin/users/{userId}/history`,
  `GET /api/auth/admin/stats` — admin analytics (totals, verified/unverified, roles,
  last-6-months signups)
- `GET /api/admin/export-users` — Excel export of all users (admin-only; distinct from the
  personal reports below)

## Reports (`/api/reports`) — personal, per-user

All of these operate only on the caller's own data and support `format=excel` or `format=pdf`:

- `GET /bills?utilityType=&format=` — monthly electricity/water report (pass `utilityType`) or
  combined expense report (omit it)
- `GET /appliances?format=` — appliance expense report
- `GET /payment-history?format=` — payment history report
- `GET /annual?year=&format=` — annual report, grouped by month with a total row
