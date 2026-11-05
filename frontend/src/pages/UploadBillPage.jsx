import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, ClipboardCheck, FileText, FileUp, PenLine, Receipt, ScanLine, Upload, X } from 'lucide-react'
import { useAuth } from '../hooks/useAuth.js'
import { useAsyncAction } from '../hooks/useAsyncAction.js'
import { createBill, uploadBillDocument } from '../services/billsService.js'
import { fetchOcrStatus } from '../services/ocrService.js'
import { PageHeader } from '../components/ui/PageHeader.jsx'
import { Card } from '../components/ui/Card.jsx'
import { Badge, ProgressBar } from '../components/ui/Badge.jsx'
import { Alert } from '../components/ui/Alert.jsx'
import { SelectField, TextField } from '../components/ui/Field.jsx'
import { LoadingButton } from '../components/LoadingButton.jsx'

const EMPTY_FORM = {
  provider: '',
  utilityType: 'ELECTRICITY',
  billingMonth: '',
  billingPeriodStart: '',
  billingPeriodEnd: '',
  previousReading: '',
  currentReading: '',
  unitsConsumed: '',
  billAmount: '',
  fixedCharges: '',
  additionalCharges: '',
  issueDate: '',
  dueDate: '',
}

// Must stay in step with the backend's multipart limit so a rejected file never wastes an upload.
const MAX_FILE_BYTES = 12 * 1024 * 1024
const ALLOWED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png']

const UTILITY_OPTIONS = [
  { value: 'ELECTRICITY', label: 'Electricity' },
  { value: 'WATER', label: 'Water' },
]

/** Human-readable names for the backend's `extractionMethod`, shown in the subtle info line. */
const EXTRACTION_METHOD_LABELS = {
  PDF_TEXT: 'the PDF text layer',
  OCR_IMAGE: 'OCR on the uploaded image',
  OCR_SCANNED_PDF: 'OCR on a scanned PDF',
  NONE: 'nothing readable',
}

/** Below this OCR confidence we flag the auto-filled fields so the user double-checks them. */
const LOW_CONFIDENCE_THRESHOLD = 65

const STAGES = [
  { key: 'uploading', label: 'Uploading' },
  { key: 'processing', label: 'Running OCR' },
  { key: 'reviewing', label: 'Waiting for review' },
  { key: 'saving', label: 'Saving' },
]

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 })

function formatMoney(value) {
  return money.format(Number.isFinite(value) ? value : 0)
}

/** Empty strings become 0 so the charges breakdown can sum partial input safely. */
function toAmount(value) {
  if (value === '' || value === null || value === undefined) return 0
  return Number.isFinite(Number(value)) ? Number(value) : 0
}

function formatFileSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Rejects bad files instantly, before a slow upload is even attempted. */
function validateFile(candidate) {
  if (!candidate) return 'Choose a PDF, JPG or PNG file to upload.'
  const extension = candidate.name.split('.').pop()?.toLowerCase() || ''
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return 'That file type is not supported. Please upload a PDF, JPG or PNG.'
  }
  if (candidate.size === 0) {
    return 'That file appears to be empty. Please choose another file.'
  }
  if (candidate.size > MAX_FILE_BYTES) {
    return `That file is too large (${formatFileSize(candidate.size)}). Please upload a file under 12 MB.`
  }
  return ''
}

function StageTracker({ stage, uploadPercent }) {
  const activeIndex = STAGES.findIndex((s) => s.key === stage)
  return (
    <div className="eco-stack" style={{ gap: 8 }} aria-label="Upload progress">
      <span className="eco-small eco-muted" style={{ margin: 0 }}>
        Progress
      </span>
      <div className="eco-row" style={{ gap: 8 }}>
        {STAGES.map((s, index) => {
          const state = index < activeIndex ? 'done' : index === activeIndex ? 'active' : 'upcoming'
          const label = state === 'active' && s.key === 'uploading' ? `Uploading ${uploadPercent}%` : s.label
          return (
            <Badge
              key={s.key}
              tone={state === 'active' ? 'primary' : state === 'done' ? 'water' : 'default'}
              icon={state === 'done' ? Check : undefined}
            >
              {label}
            </Badge>
          )
        })}
      </div>
    </div>
  )
}

export function UploadBillPage() {
  const { token, setAuthMessage, setAuthError } = useAuth()
  const navigate = useNavigate()

  const inputRef = useRef(null)
  const [utilityType, setUtilityType] = useState('ELECTRICITY')
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [fileError, setFileError] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const [ocrAvailable, setOcrAvailable] = useState(null)
  const [documentInfo, setDocumentInfo] = useState(null)
  const [entrySource, setEntrySource] = useState('MANUAL')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [stage, setStage] = useState('idle')
  const [uploadPercent, setUploadPercent] = useState(0)
  // Diagnostics from GET /api/ocr/status — drives the "OCR unavailable" banner.
  const [ocrStatus, setOcrStatus] = useState(null)
  // Which fields the last extraction filled, plus its confidence, so they can be highlighted.
  const [autoFilled, setAutoFilled] = useState(() => new Set())
  const [extractionInfo, setExtractionInfo] = useState(null)

  // Probe the server's OCR engine once on mount. A failure just hides the banner — the page
  // (including manual entry) must keep working exactly as before when OCR is unreachable.
  useEffect(() => {
    let active = true
    fetchOcrStatus()
      .then((data) => {
        if (active) setOcrStatus(data || null)
      })
      .catch(() => {
        if (active) setOcrStatus(null)
      })
    return () => {
      active = false
    }
  }, [])

  const lowConfidence = Boolean(
    extractionInfo && extractionInfo.confidence != null && extractionInfo.confidence < LOW_CONFIDENCE_THRESHOLD,
  )

  const updateField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }))

  /** Marks a field as auto-filled, and returns the help text with a badge when it is. */
  const statusHelp = (fieldKey, text) => {
    if (!autoFilled.has(fieldKey)) return text
    return (
      <>
        {text}{' '}
        <Badge tone={lowConfidence ? 'earth' : 'primary'}>{lowConfidence ? 'Check this' : 'Auto-filled'}</Badge>
      </>
    )
  }

  const selectFile = (candidate) => {
    const problem = validateFile(candidate)
    setFileError(problem)
    setFile(problem ? null : candidate)
    setUploadPercent(0)
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      if (problem || !candidate || !candidate.type?.startsWith('image/')) return ''
      return URL.createObjectURL(candidate)
    })
  }

  const clearFile = () => {
    setFile(null)
    setFileError('')
    setUploadPercent(0)
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return ''
    })
  }

  const openPicker = () => inputRef.current?.click()

  const handleDrop = (event) => {
    event.preventDefault()
    setDragActive(false)
    const dropped = event.dataTransfer?.files?.[0]
    if (dropped) selectFile(dropped)
  }

  const { run: handleExtract, loading: extracting } = useAsyncAction(async () => {
    if (!token) {
      setAuthMessage('Please sign in again to upload a bill.')
      setAuthError(true)
      return
    }
    const problem = validateFile(file)
    if (problem) {
      setFileError(problem)
      return
    }
    setFileError('')
    setStage('uploading')
    setUploadPercent(0)
    try {
      const result = await uploadBillDocument(file, utilityType, token, (percent) => {
        setUploadPercent(percent)
        // The browser can only report progress while bytes are being sent; once they are all on the
        // server the remaining wait is the server running OCR. This is a real hand-off, not a timer.
        if (percent >= 100) setStage('processing')
      })
      setOcrAvailable(result.ocrAvailable)
      setDocumentInfo({
        documentPath: result.documentPath,
        documentOriginalName: result.documentOriginalName,
      })

      // Work out which fields the extraction actually filled so the form can highlight them.
      const foundNames = Array.isArray(result.fieldsFound) ? new Set(result.fieldsFound) : null
      const nextAutoFilled = new Set()
      const markFilled = (fieldKey, parserName, hasValue) => {
        if (!hasValue) return
        if (foundNames && !foundNames.has(parserName)) return
        nextAutoFilled.add(fieldKey)
      }
      markFilled('billAmount', 'amount', result.extractedAmount != null)
      markFilled('unitsConsumed', 'units', result.extractedUnits != null)
      markFilled('issueDate', 'issueDate', Boolean(result.extractedIssueDate))
      markFilled('dueDate', 'dueDate', Boolean(result.extractedDueDate))
      markFilled('previousReading', 'previousReading', result.extractedPreviousReading != null)
      markFilled('currentReading', 'currentReading', result.extractedCurrentReading != null)
      markFilled('billingPeriodStart', 'billingPeriodStart', Boolean(result.extractedBillingPeriodStart))
      markFilled('billingPeriodEnd', 'billingPeriodEnd', Boolean(result.extractedBillingPeriodEnd))

      const confidence = Number.isFinite(result.confidence) ? result.confidence : null
      const monthSource = result.extractedBillingPeriodStart || result.extractedIssueDate || ''
      setAutoFilled(nextAutoFilled)
      setExtractionInfo({ method: result.extractionMethod || 'NONE', confidence })
      setForm((prev) => ({
        ...prev,
        utilityType,
        billAmount: result.extractedAmount != null ? String(result.extractedAmount) : prev.billAmount,
        unitsConsumed: result.extractedUnits != null ? String(result.extractedUnits) : prev.unitsConsumed,
        issueDate: result.extractedIssueDate || prev.issueDate,
        dueDate: result.extractedDueDate || prev.dueDate,
        previousReading:
          result.extractedPreviousReading != null ? String(result.extractedPreviousReading) : prev.previousReading,
        currentReading:
          result.extractedCurrentReading != null ? String(result.extractedCurrentReading) : prev.currentReading,
        billingPeriodStart: result.extractedBillingPeriodStart || prev.billingPeriodStart,
        billingPeriodEnd: result.extractedBillingPeriodEnd || prev.billingPeriodEnd,
        billingMonth: prev.billingMonth || (monthSource ? monthSource.slice(0, 7) : ''),
      }))
      setEntrySource('OCR')
      setShowForm(true)
      setStage('reviewing')
      setAuthMessage('Extraction complete. Please review the details below.')
      setAuthError(false)
    } catch (err) {
      setStage('idle')
      setUploadPercent(0)
      setAuthMessage(err.message)
      setAuthError(true)
    }
  })

  const handleSkip = () => {
    setForm((prev) => ({ ...prev, utilityType }))
    setDocumentInfo(null)
    setOcrAvailable(null)
    setEntrySource('MANUAL')
    setStage('idle')
    setUploadPercent(0)
    setAutoFilled(new Set())
    setExtractionInfo(null)
    setShowForm(true)
  }

  const handleBack = () => {
    setShowForm(false)
    if (documentInfo) setStage('idle')
  }

  const { run: handleSave, loading: saving } = useAsyncAction(async (e) => {
    e.preventDefault()
    if (!token) {
      setAuthMessage('Please sign in again to save a bill.')
      setAuthError(true)
      return
    }
    if (documentInfo) setStage('saving')
    try {
      const payload = {
        provider: form.provider,
        utilityType: form.utilityType,
        billingMonth: form.billingMonth,
        billingPeriodStart: form.billingPeriodStart,
        billingPeriodEnd: form.billingPeriodEnd,
        previousReading: form.previousReading === '' ? null : Number(form.previousReading),
        currentReading: form.currentReading === '' ? null : Number(form.currentReading),
        unitsConsumed: form.unitsConsumed === '' ? null : Number(form.unitsConsumed),
        billAmount: form.billAmount === '' ? null : Number(form.billAmount),
        fixedCharges: form.fixedCharges === '' ? null : Number(form.fixedCharges),
        additionalCharges: form.additionalCharges === '' ? null : Number(form.additionalCharges),
        issueDate: form.issueDate,
        dueDate: form.dueDate,
        paymentStatus: 'PENDING',
        paymentDate: null,
        documentPath: documentInfo?.documentPath || null,
        documentOriginalName: documentInfo?.documentOriginalName || null,
        entrySource,
      }
      await createBill(payload, token)
      setAuthMessage('Bill saved successfully.')
      setAuthError(false)
      navigate('/bills')
    } catch (err) {
      if (documentInfo) setStage('reviewing')
      setAuthMessage(err.message)
      setAuthError(true)
    }
  })

  const chargesTotal = toAmount(form.billAmount) + toAmount(form.fixedCharges) + toAmount(form.additionalCharges)

  return (
    <div className="eco-stack">
      <PageHeader
        breadcrumbs={[{ label: 'Overview', onClick: () => navigate('/dashboard') }, { label: 'Upload bill' }]}
        eyebrow="Scan & verify"
        title="Upload a bill"
        description="Upload a PDF or photo of your electricity or water bill and EcoTrack will try to extract the key details automatically. You can always review and correct everything before saving."
        icon={Upload}
      />

      {ocrStatus && ocrStatus.available === false ? (
        <Alert variant="warn" className="eco-card-gap">
          Automatic OCR is unavailable on this server, so bills can&apos;t be read automatically.
          {ocrStatus.reason ? ` ${ocrStatus.reason}` : ''} You can still upload the file and enter the details
          manually below.
        </Alert>
      ) : null}

      {stage !== 'idle' ? <StageTracker stage={stage} uploadPercent={uploadPercent} /> : null}

      {!showForm && (
        <Card
          title="Step 1 · Choose your bill"
          subtitle="Pick the utility, then add the file you want EcoTrack to read."
          icon={FileUp}
          footer={
            <button type="button" className="eco-btn eco-btn-ghost" onClick={handleSkip}>
              <PenLine size={15} aria-hidden="true" />
              Skip upload, enter manually
            </button>
          }
        >
          <SelectField
            label="Utility type"
            value={utilityType}
            onChange={(e) => setUtilityType(e.target.value)}
            options={UTILITY_OPTIONS}
            help="Electricity bills are read in kWh, water bills in kL."
          />

          <div
            className={`eco-dropzone ${dragActive ? 'is-active' : ''}`.trim()}
            role="button"
            tabIndex={0}
            onClick={openPicker}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                openPicker()
              }
            }}
            onDragOver={(e) => {
              e.preventDefault()
              setDragActive(true)
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
          >
            <span className="eco-dropzone-icon">
              <FileUp size={24} aria-hidden="true" />
            </span>
            <p style={{ margin: '0 0 4px', fontWeight: 700, color: 'var(--color-text)' }}>
              Drag &amp; drop your bill here or click to browse
            </p>
            <p className="eco-small eco-muted" style={{ margin: '0 0 16px' }}>
              PDF, JPG or PNG · up to 12 MB
            </p>
            <button
              type="button"
              className="eco-btn eco-btn-secondary eco-btn-sm"
              onClick={(e) => {
                e.stopPropagation()
                openPicker()
              }}
            >
              <Upload size={15} aria-hidden="true" />
              Browse files
            </button>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            hidden
            onChange={(e) => {
              selectFile(e.target.files?.[0] || null)
              e.target.value = ''
            }}
          />

          {file ? (
            <div className="eco-stack eco-card-gap">
              {previewUrl ? (
                <img className="eco-meter-preview" src={previewUrl} alt="Preview of the selected bill" />
              ) : null}
              <div className="eco-between">
                <span className="eco-row" style={{ gap: 8 }}>
                  <FileText size={16} aria-hidden="true" />
                  <span className="eco-soft">
                    {file.name} · {formatFileSize(file.size)}
                  </span>
                </span>
                <button
                  type="button"
                  className="eco-btn eco-btn-ghost eco-btn-sm"
                  onClick={clearFile}
                  disabled={extracting}
                >
                  <X size={14} aria-hidden="true" />
                  Remove
                </button>
              </div>
            </div>
          ) : null}

          {fileError ? (
            <Alert variant="error" className="eco-card-gap" onClose={() => setFileError('')}>
              {fileError}
            </Alert>
          ) : null}

          {stage === 'uploading' || stage === 'processing' ? (
            <div className="eco-stack eco-card-gap">
              <ProgressBar
                label={stage === 'processing' ? 'Running OCR' : 'Uploading'}
                valueLabel={stage === 'processing' ? 'On the server' : `${uploadPercent}%`}
                value={uploadPercent}
              />
              {stage === 'processing' ? (
                <p className="eco-small eco-muted" style={{ margin: 0 }}>
                  Reading your bill and extracting the details. This can take a few seconds.
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="eco-card-gap">
            <LoadingButton
              className="eco-btn eco-btn-primary"
              onClick={handleExtract}
              loading={extracting}
              loadingText={stage === 'processing' ? 'Processing…' : `Uploading… ${uploadPercent}%`}
            >
              <ScanLine size={16} aria-hidden="true" />
              Extract with OCR
            </LoadingButton>
          </div>
        </Card>
      )}

      {showForm && (
        <form onSubmit={handleSave}>
          <Card
            title="Step 3 · Check the extracted details"
            subtitle="Confirm or correct anything EcoTrack read, then save the bill."
            icon={ClipboardCheck}
            footer={
              <div className="eco-between" style={{ width: '100%' }}>
                <button
                  type="button"
                  className="eco-btn eco-btn-secondary"
                  onClick={handleBack}
                  disabled={saving}
                >
                  <ArrowLeft size={15} aria-hidden="true" />
                  Back
                </button>
                <LoadingButton
                  type="submit"
                  className="eco-btn eco-btn-primary"
                  loading={saving}
                  loadingText="Saving…"
                >
                  <Check size={16} aria-hidden="true" />
                  Save bill
                </LoadingButton>
              </div>
            }
          >
            {entrySource === 'OCR' && documentInfo ? (
              <Alert variant="success" className="eco-card-gap">
                Extraction complete. Please review the details below.
              </Alert>
            ) : null}

            {entrySource === 'OCR' && extractionInfo ? (
              <p className="eco-small eco-muted" style={{ margin: 0 }}>
                Read from {EXTRACTION_METHOD_LABELS[extractionInfo.method] || extractionInfo.method}
                {extractionInfo.confidence != null ? ` · OCR confidence ${extractionInfo.confidence}%` : ''}.
                {lowConfidence ? ' The highlighted fields looked less certain, so please double-check them.' : ''}
              </p>
            ) : null}

            {ocrAvailable === false ? (
              <Alert variant="info" className="eco-card-gap">
                Automatic extraction isn&apos;t available on this server yet — enter the details below manually.
              </Alert>
            ) : null}

            <div className="eco-form-section">
              <p className="eco-form-section-title">
                <Receipt size={15} aria-hidden="true" />
                Bill details
              </p>

              <div className="eco-field-row">
                <TextField
                  label="Provider name"
                  value={form.provider}
                  onChange={(e) => updateField('provider', e.target.value)}
                  required
                  help="The name printed on the bill, e.g. your electricity board."
                />
                <SelectField
                  label="Utility type"
                  value={form.utilityType}
                  onChange={(e) => updateField('utilityType', e.target.value)}
                  options={UTILITY_OPTIONS}
                  help="Electricity is measured in kWh, water in kL."
                />
              </div>

              <div className="eco-field-row">
                <TextField
                  label="Billing month"
                  type="month"
                  value={form.billingMonth}
                  onChange={(e) => updateField('billingMonth', e.target.value)}
                  help="The month the bill covers, e.g. 2026-03."
                />
                <TextField
                  label="Issue date"
                  type="date"
                  value={form.issueDate}
                  onChange={(e) => updateField('issueDate', e.target.value)}
                  help={statusHelp('issueDate', 'The date the bill was generated.')}
                />
                <TextField
                  label="Due date"
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => updateField('dueDate', e.target.value)}
                  help={statusHelp('dueDate', 'Pay before this date to avoid a late fee.')}
                />
              </div>

              <div className="eco-field-row">
                <TextField
                  label="Billing period start"
                  type="date"
                  value={form.billingPeriodStart}
                  onChange={(e) => updateField('billingPeriodStart', e.target.value)}
                  help={statusHelp('billingPeriodStart', 'First day of the reading period.')}
                />
                <TextField
                  label="Billing period end"
                  type="date"
                  value={form.billingPeriodEnd}
                  onChange={(e) => updateField('billingPeriodEnd', e.target.value)}
                  help={statusHelp('billingPeriodEnd', 'Last day of the reading period.')}
                />
              </div>
            </div>

            <div className="eco-form-section">
              <p className="eco-form-section-title">
                <ScanLine size={15} aria-hidden="true" />
                Meter readings
              </p>

              <div className="eco-field-row">
                <TextField
                  label="Previous meter reading"
                  type="number"
                  step="0.01"
                  value={form.previousReading}
                  onChange={(e) => updateField('previousReading', e.target.value)}
                  help={statusHelp('previousReading', 'The last reading before this period.')}
                />
                <TextField
                  label="Current meter reading"
                  type="number"
                  step="0.01"
                  value={form.currentReading}
                  onChange={(e) => updateField('currentReading', e.target.value)}
                  help={statusHelp('currentReading', 'The reading shown on this bill.')}
                />
                <TextField
                  label="Units consumed"
                  type="number"
                  step="0.01"
                  value={form.unitsConsumed}
                  onChange={(e) => updateField('unitsConsumed', e.target.value)}
                  help={statusHelp('unitsConsumed', 'Energy or water used this period (kWh or kL).')}
                />
              </div>
            </div>

            <div className="eco-form-section">
              <p className="eco-form-section-title">
                <Receipt size={15} aria-hidden="true" />
                Charges
              </p>

              <div className="eco-field-row">
                <TextField
                  label="Bill amount (₹)"
                  type="number"
                  step="0.01"
                  value={form.billAmount}
                  onChange={(e) => updateField('billAmount', e.target.value)}
                  required
                  help={statusHelp('billAmount', 'The total payable on the bill.')}
                />
                <TextField
                  label="Fixed charges (₹)"
                  type="number"
                  step="0.01"
                  value={form.fixedCharges}
                  onChange={(e) => updateField('fixedCharges', e.target.value)}
                  help="Standing charge already included in the total."
                />
                <TextField
                  label="Additional charges (₹)"
                  type="number"
                  step="0.01"
                  value={form.additionalCharges}
                  onChange={(e) => updateField('additionalCharges', e.target.value)}
                  help="Taxes, duties or arrears shown separately."
                />
              </div>

              <div className="eco-summary-row">
                <span>Bill amount</span>
                <span className="eco-summary-value">{formatMoney(toAmount(form.billAmount))}</span>
              </div>
              <div className="eco-summary-row">
                <span>Fixed charges</span>
                <span className="eco-summary-value">{formatMoney(toAmount(form.fixedCharges))}</span>
              </div>
              <div className="eco-summary-row">
                <span>Additional charges</span>
                <span className="eco-summary-value">{formatMoney(toAmount(form.additionalCharges))}</span>
              </div>
              <div className="eco-summary-row is-total">
                <span>Computed total</span>
                <span className="eco-summary-value">{formatMoney(chargesTotal)}</span>
              </div>
            </div>
          </Card>
        </form>
      )}
    </div>
  )
}
