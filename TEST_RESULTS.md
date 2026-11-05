# Test results — final hardening pass (Phases 9-10)

Verification run on 2026-11-01.

## Backend

- `./mvnw.cmd -q compile` — **PASS** (exit 0, no output).
- `./mvnw.cmd -q test` — **PASS** (exit 0). `BackendApplicationTests` (context-load test)
  starts successfully. Note: in this dev environment there is no reachable MongoDB Atlas
  cluster, so startup logs show MongoDB SRV-lookup warnings and the admin-bootstrap/tariff-seed
  steps log "Could not check/bootstrap..." warnings — these are pre-existing, already
  gracefully-handled (try/catch around startup bootstrapping) and did not affect the test run's
  exit code.

## Frontend

- `npm run build` — **PASS**.
- `npm run lint` — **PASS, 0 errors** (previously 3 known/accepted errors; see below).

## Lint cleanup (Part C.1)

All three previously-flagged ESLint errors are fixed, not suppressed:

1. `AppStateContext.jsx` `react-hooks/set-state-in-effect` — the billing-estimate effect
   synchronously called `setBillingEstimate`/`setBillingBusy`/`setBillingError` in the
   "inputs cleared" branch outside the debounce timer. Restructured so that branch now runs
   inside the same `setTimeout` callback as the debounced fetch, so no setState call happens
   synchronously in the effect body anymore.
2. `AppStateContext.jsx` `react-refresh/only-export-components` — the file exported both the
   `AppStateProvider` component and the `useAppState` hook. Moved `AppStateContext` (the
   `createContext` call) and `useAppState` into a new `frontend/src/hooks/useAppState.js`;
   `AppStateContext.jsx` now imports the context back and exports only the `AppStateProvider`
   component.
3. `AuthContext.jsx` — same fix via a new `frontend/src/hooks/useAuth.js` holding `AuthContext`
   and `useAuth`; `AuthContext.jsx` now exports only `AuthProvider`.

All 16 import sites that did `import { useAuth } from '../context/AuthContext.jsx'` or
`import { useAppState } from '../context/AppStateContext.jsx'` were updated to import from
`../hooks/useAuth.js` / `../hooks/useAppState.js` instead: `layouts/AppLayout.jsx`,
`pages/AdminDashboardPage.jsx`, `pages/AdminLoginPage.jsx`, `pages/AdminTariffManagementPage.jsx`,
`pages/AppliancesPage.jsx`, `pages/BillHistoryPage.jsx`, `pages/BudgetManagementPage.jsx`,
`pages/DashboardPage.jsx`, `pages/LoginPage.jsx`, `pages/ManualCheckerPage.jsx`,
`pages/NotificationsPage.jsx`, `pages/ProfilePage.jsx`, `pages/SignupPage.jsx`,
`pages/TariffsPage.jsx`, `pages/UploadBillPage.jsx`, `pages/VerifyOtpPage.jsx`.

The new `AdminDashboardPage.jsx` stats effect hit the same `set-state-in-effect` rule; fixed the
same way the codebase already handles it elsewhere (`BudgetManagementPage`/`NotificationsPage`):
extracted a `useCallback`-wrapped async `refreshStats`, called from the effect with the
project's existing `eslint-disable-next-line react-hooks/set-state-in-effect` + justification
comment convention.

## Security review (Part C.2) — findings and fixes

- **Ownership checks**: audited every controller/service endpoint taking a user-owned resource
  id (bills, appliances, recommendations, notifications). All already correctly check
  `resource.getUserId().equals(user.getId())` or admin role
  (`BillService.requireOwnedBill`, `ApplianceService.requireOwnedAppliance`,
  `RecommendationService.markCompleted`, `NotificationService.markRead`) — no gaps found here.
  Tariffs are admin-managed (no per-user ownership concept), consistent with the spec's
  exemption.
- **Path traversal**: `FileStorageService.readAsBytes`/`readAsStream`/`delete` all resolve
  against the uploads root and verify `target.startsWith(uploadsRoot)` before touching the
  filesystem — guard confirmed intact, no change needed.
- **Exception leakage — fixed**: `GlobalExceptionHandler.handleOther` was returning
  `ex.getMessage()` (the raw exception message) for any unhandled exception, which can leak
  internal details (Mongo/driver errors, file paths, etc.) to the client. Changed to log the
  exception server-side and return a generic `"Unexpected server error. Please try again
  later."` message instead. `ApiException` (the deliberate, client-safe error path) and
  validation errors are unaffected and still return their specific messages.
- **Input validation — added**: `CreateBillRequest` (utilityType/billingMonth `@NotBlank`,
  monetary/unit fields `@PositiveOrZero`), `CreateApplianceRequest` (name `@NotBlank`,
  quantity/wattage/daysPerMonth `@Positive`, hoursPerDay `@DecimalMin`/`@DecimalMax` 0-24),
  and `UpdateBudgetRequest` (`@PositiveOrZero` on both budget fields) now carry bean-validation
  annotations, wired up with `@Valid` on `BillController.create`, `ApplianceController.create`,
  and `BudgetController.updateBudget`. These return a clean 400 via the existing
  `MethodArgumentNotValidException` handler instead of failing deeper in the service layer.
  `ApplianceService`'s existing manual validation is unchanged and still runs as a second layer.

## UI polish (Part C.3)

- Loading indicators verified present for `DashboardPage`, `BillHistoryPage`, `AppliancesPage`,
  `BudgetManagementPage`, `NotificationsPage` (all pre-existing). Added a "Loading system
  statistics…" indicator to the new `AdminDashboardPage` stats section.
- Delete confirmation: `BillHistoryPage` already confirms before deleting a bill
  (`window.confirm`). **Fixed a gap**: `AppliancesPage.handleDelete` had no confirmation step —
  added `window.confirm('Delete this appliance?')` before deleting.

## New features added (Parts A & B)

- **Part A**: `AdminAnalyticsService` + `GET /api/auth/admin/stats` (chosen prefix: matches
  this controller's existing `/api/auth/admin/*` convention, distinct from
  `AdminExportController`'s separate `/api/admin/export-users`). Added `UserAccount.createdAt`
  (nullable; only populated going forward) so `signupsByMonth` reports real last-6-months signup
  counts without fabricating history for pre-existing accounts. Frontend: `getAdminStats` in
  `adminService.js`, stat tiles at the top of `AdminDashboardPage.jsx`.
- **Part B**: `ReportService` + `ReportController` (`/api/reports/*`), all scoped to the caller's
  own bills/appliances, Excel via Apache POI and PDF via Apache PDFBox (shared `writeExcel`/
  `writePdf` helpers, one per report method). Frontend: `reportService.js` + new `ReportsPage.jsx`
  at `/reports`, added to the sidebar after Notifications and to `AppLayout`'s standalone-page
  list.

---

# Test results — security fixes and full-site QA

Verification run on 2026-11-03.

## 1. Confirmed decisions

### A. Admin registration security — applied and verified

- Backend: `AuthService.signup(...)` forces `UserRole.CUSTOMER` on **both** the "new account" and
  the "unverified re-signup" branches; the `role` field sent by the client is ignored.
  Live proof: `POST /api/auth/signup` with `"role":"ADMIN"` created an account whose role is
  `CUSTOMER` (confirmed via `GET /api/auth/admin/users`).
- Frontend: `SignupPage.jsx` has no Administrator / role selector at all; the sign-up form only
  collects customer fields. No residue of the old role option (grep for "Administrator" → none).
- The bootstrapped `admin@ecotrack.com` is untouched and still `ADMIN` (startup logged no
  re-bootstrap). Existing accounts were not downgraded.

### B. About page layout — applied and verified

- `/about` is rendered inside `PublicLayout` (same marketing navbar + footer as the other public
  pages). Anonymous visitors see only the public navbar (no avatar, no signed-in navigation) and
  the public footer. Page content/functionality unchanged.

## 2. Build / static verification (executed)

| Command | Result |
| --- | --- |
| `npm run lint` (frontend) | PASS — 0 errors, 0 warnings |
| `npm run build` (frontend) | PASS — 2701 modules, built in ~8.9s (only the pre-existing >500 kB chunk warning from Recharts) |
| `.\mvnw.cmd -q compile` (backend) | PASS — exit 0 |
| `.\mvnw.cmd -q test` (backend) | PASS — `BackendApplicationTests` context loads; Mongo connected (`state=CONNECTED`) |

Static route/link audit: every `NAV_LINKS` entry in `AppLayout` (`/dashboard`, `/upload-bill`,
`/bills`, `/manual`, `/prediction`, `/appliances`, `/analytics`, `/budget`, `/tariffs`, `/reports`)
has a matching `<Route>` in `App.jsx`; admin links (`/admin-dashboard`, `/admin/tariffs`) are
route-guarded by `RequireAdmin`.

## 3. Live API testing (executed against a running backend)

Backend was restarted from the current source on `:8080`. Security tests were additionally run
against a controlled instance on `:8085` (started with test-only command-line overrides
`--otp.demo-fallback-enabled=true --app.mail.async=false --spring.mail.host=127.0.0.1` so a
verification OTP could be obtained without a working SMTP server; **no source/config files were
changed** for this). The `:8085` instance was stopped afterwards.

51 functional/security checks were executed; **51 passed** (the 2 initial "failures" were the QA
script omitting a required `utilityType` query param, and both endpoints returned 200 once the
param was supplied — see below).

### Security

| Check | Result |
| --- | --- |
| signup with `role=ADMIN` → account role | PASS — `CUSTOMER` |
| verified CUSTOMER token → `GET /api/auth/profile` | PASS — `role=CUSTOMER` |
| CUSTOMER → `/api/auth/admin/stats` | PASS — 403 `Access denied. Admin credentials required.` |
| CUSTOMER → `/api/auth/admin/users` | PASS — 403 |
| CUSTOMER → `/api/admin/tariffs` | PASS — 403 |
| CUSTOMER → `/api/admin/export-users` | PASS — 403 |
| no token → `GET /api/auth/profile` | PASS — 400 `Missing session token.` |
| invalid token → `GET /api/auth/admin/users` | PASS — 401 `Invalid or expired session token.` |
| ADMIN token → all admin endpoints | PASS — 200 |
| ownership: user B GET/DELETE user A's bill | PASS — 403 both |
| users in DB after run | PASS — 15 CUSTOMER + 1 ADMIN, no unexpected roles |

### Features (authenticated CUSTOMER)

| Feature | Endpoint(s) exercised | Result |
| --- | --- | --- |
| Dashboard summary/charts | `GET /api/dashboard/summary`, `/charts` | PASS |
| Bill create / read / update / mark-paid / delete | `POST /api/bills`, `GET/PUT/DELETE /api/bills/{id}`, `PUT .../mark-paid` | PASS |
| Appliance create / read / update / breakdown / delete | `/api/appliances*` | PASS |
| Budget read / update / status | `GET/PUT /api/budget`, `GET /api/budget/status` | PASS |
| Calculator (manual estimate) | `POST /api/billing/estimate` | PASS |
| Appliance estimate | `POST /api/billing/appliances/estimate` | PASS |
| Tariff catalogue | `GET /api/billing/tariffs` | PASS |
| Prediction | `GET /api/predictions/upcoming?utilityType=…` | PASS |
| Anomaly detection | `GET /api/anomalies/check?utilityType=…` | PASS |
| Notifications + preferences | `GET /api/notifications`, `/preferences` | PASS |
| Recommendations | `GET /api/recommendations` | PASS |
| Reports: bills (excel+pdf), appliances, payment history, annual | `GET /api/reports/*` | PASS |
| Admin overview / users / history / export | `GET /api/auth/admin/*`, `GET /api/admin/export-users` | PASS |
| Admin tariff list + version history (read-only) | `GET /api/admin/tariffs`, `/history` | PASS |
| Bill document upload (multipart PNG) | `POST /api/bills/upload` | PASS — HTTP 200. With Tesseract now installed, `ocrAvailable:true` and `extractionMethod:OCR_IMAGE` (see §7). |

## 4. Test accounts created (clearly identified; left in place — no API exists to delete users)

- `qa.role.1793722972@ecotrack.test` — signup with `role=ADMIN` (unverified; role-forcing check)
- `qa.cust.1793723067@ecotrack.test` — signup (unverified)
- `qa.cust.1793723196@ecotrack.test` — verified CUSTOMER (main functional-test login)
- `qa.owner.1793723352@ecotrack.test` — verified CUSTOMER (cross-account ownership check)

No existing user account or pre-existing data was modified or deleted.

## 5. Not verifiable in this environment (reported honestly, not marked as passed)

- **Real browser click-through** (console errors, failed network requests, desktop/tablet/mobile
  layouts, light/dark theme toggling, login/logout clicking): no browser-automation tool is
  available in this environment. Verified instead by successful lint + production build, the
  Vite dev server serving `/`, `/about` and `/dashboard` (HTTP 200 SPA shell), static route/guard
  audit, and the API-level tests above.
- **Real browser click-through** for the OCR UI banners: verified at the API level instead (see §7).
- **OTP e-mail delivery**: Gmail SMTP authentication failed with the configured app password
  (`FAILED TO SEND EMAIL … Authentication failed`); the app handles it gracefully (message says
  delivery is unavailable). Not a code defect.

## 6. Observations / residual risk (not changed — out of scope, would require API changes)

- Logout clears the token client-side only; there is no server-side session-invalidation endpoint,
  so a copied `X-Session-Token` stays valid until the backend restarts. This is inherent to the
  existing `X-Session-Token` design and was left as-is per the "do not introduce JWT / do not
  change APIs unnecessarily" constraints.
- A stale backend process from an earlier session is still listening on `:8081`; it was not started
  by this QA run and was left untouched.

## 7. Bill & meter OCR rework — verification

Verification run on 2026-11-05.

**Tesseract install found (Windows):**

- Executable: `C:\Program Files\Tesseract-OCR\tesseract.exe` (not on `PATH` — that is fine).
- tessdata used: `C:\Program Files\Tesseract-OCR\tessdata` (contains `eng.traineddata`, `osd.traineddata`).
- Configured via `app.ocr.tessdata-path=C:/Program Files/Tesseract-OCR/tessdata` in
  `application.properties`. Startup self-check logged:
  `OCR self-check: available. tessdataPath=C:\Program Files\Tesseract-OCR\tessdata, languages=[eng, osd], psm=6, maxPdfPages=10.`

**Automated tests (`.\mvnw.cmd -q test` in `backend/`) — PASS (exit 0):**

| Test set | Tests | Result |
| --- | --- | --- |
| `BackendApplicationTests` | 1 | PASS |
| `service.BillFieldParserTest` | 11 | PASS — electricity (MSEDCL, Adani/noisy, BEST, Tata Power), water (clean + noisy), fallbacks, date/number helpers |
| `BillUploadOcrIntegrationTest` | 1 | PASS — **not skipped** (real OCR): generated PNG extracts amount `1245.00`, units `312`, due date `2026-11-15`, `extractionMethod=OCR_IMAGE` |

The integration test is guarded by `Assumptions.assumeTrue(ocrExtractionService.isAvailable())`, so
on a machine without Tesseract it self-skips rather than fails.

**Frontend:** `npm run build` — PASS (vite production build, exit 0).

**Manual / API checks (live backend on `:8080`, real Tesseract):**

Four samples were generated with PDFBox/`BufferedImage` (text PDF, image-only PDF, an EXIF
orientation-6 JPG, and a control JPG with the same sideways pixels but no EXIF tag) and each was
posted to `POST /api/bills/upload`:

| Sample | `extractionMethod` | amount | units | due date | confidence |
| --- | --- | --- | --- | --- | --- |
| text PDF | `PDF_TEXT` | 1245.0 | 312.0 | 2026-11-15 | – (no OCR) |
| scanned image-only PDF | `OCR_SCANNED_PDF` | 1245.0 | 312.0 | 2026-11-15 | 96 |
| rotated JPG (EXIF 6) | `OCR_IMAGE` | 1245.0 | 312.0 | 2026-11-15 | 96 |
| same sideways JPG, **no** EXIF | `OCR_IMAGE` | – | – | – | 49 |

The control row is the key evidence: the same sideways pixels read perfectly once the EXIF
orientation tag is honoured (96) and fail to parse without it (49), so EXIF correction is real and
not accidental. The text PDF is served by PDFBox's text layer; the image-only PDF is rendered at
300 DPI and OCR'd; the meter reader (`POST /api/ocr/meter`, digits-only whitelist) returned
`reading=12345, confidence=96` for a generated meter photo and `null` + a reason when nothing was
found — it never invents a number.

**Degraded mode (OCR unavailable)** — a second backend instance was started on `:8099` requesting a
missing language so no `*.traineddata` resolves. It **still started successfully** (the self-check
never blocks boot) and logged the real cause plus a one-line fix. In that state:

- `GET /api/ocr/status` → `{ available:false, reason:"Tesseract tessdata for '…' was not found…" }`.
- `POST /api/bills/upload` with an image → **HTTP 200**, `ocrAvailable:false`, `extractionMethod:NONE`,
  `reason` populated — no 5xx, no crash.
- Manual bill entry + save (`POST /api/bills`) still worked (`id` returned, amount persisted).

So if the new OCR endpoints fail, the upload page still behaves exactly as before and manual saving
is unaffected.

Existing features re-confirmed live on `:8080`: login, `GET /api/dashboard/summary`,
`GET /api/bills` (history), and manual bill create/save.
