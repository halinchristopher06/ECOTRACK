import { useEffect, useState } from 'react'
import { Camera, ImageIcon } from 'lucide-react'
import { Modal } from '../ui/Modal.jsx'
import { Alert } from '../ui/Alert.jsx'
import { fetchOcrStatus } from '../../services/ocrService.js'

/** Tolerates both the rich MeterReading object and a bare number, so the modal never crashes. */
function normalizeReading(value) {
  if (value == null) {
    return { reading: null, confidence: null, ocrAvailable: true, reason: '' }
  }
  if (typeof value === 'object') {
    return {
      reading: Number.isFinite(value.reading) ? value.reading : null,
      confidence: Number.isFinite(value.confidence) ? value.confidence : null,
      ocrAvailable: value.ocrAvailable !== false,
      reason: value.reason || '',
    }
  }
  return { reading: Number.isFinite(value) ? value : null, confidence: null, ocrAvailable: true, reason: '' }
}

/**
 * Meter photo reader. The two hidden file inputs are triggered by ref so the buttons can be
 * styled properly — one opens the camera on mobile (`capture="environment"`), the other the gallery.
 */
export function MeterVisionModal({
  meterVisionType,
  setMeterVisionType,
  meterVisionBusy,
  meterVisionPreview,
  meterVisionReading,
  onClose,
  onMeterImage,
  fileCamRef,
  fileGalRef,
}) {
  const label = meterVisionType === 'electric' ? 'Electricity' : 'Water'
  const [status, setStatus] = useState(null)

  // A failed status probe must never break the dialog — it just hides the banner.
  useEffect(() => {
    let active = true
    fetchOcrStatus()
      .then((data) => {
        if (active) setStatus(data || null)
      })
      .catch(() => {
        if (active) setStatus(null)
      })
    return () => {
      active = false
    }
  }, [])

  const outcome = normalizeReading(meterVisionReading)
  const ocrOffline = status && status.available === false
  const attempted = Boolean(meterVisionPreview) && !meterVisionBusy

  return (
    <Modal open title={`${label} meter — photo read`} onClose={onClose}>
      <div className="eco-stack">
        <p className="eco-small eco-muted" style={{ margin: 0 }}>
          Which meter are you photographing?
        </p>

        <div className="eco-row">
          <label className="eco-check">
            <input
              type="radio"
              name="meterType"
              checked={meterVisionType === 'electric'}
              onChange={() => setMeterVisionType('electric')}
            />
            Electricity
          </label>
          <label className="eco-check">
            <input
              type="radio"
              name="meterType"
              checked={meterVisionType === 'water'}
              onChange={() => setMeterVisionType('water')}
            />
            Water
          </label>
        </div>

        {ocrOffline ? (
          <Alert variant="warn">
            Photo reading is unavailable on this server right now.
            {status.reason ? ` ${status.reason}` : ''} You can still type the reading into the units field
            manually.
          </Alert>
        ) : (
          <Alert variant="info">
            Take a clear photo of the digital display, or upload one from your gallery. EcoTrack suggests a
            reading from the image and fills in the matching units field — you can always edit it manually
            afterwards.
          </Alert>
        )}

        <input
          ref={fileCamRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="eco-sr-only"
          tabIndex={-1}
          onChange={(event) => onMeterImage(event, meterVisionType)}
        />
        <input
          ref={fileGalRef}
          type="file"
          accept="image/*"
          className="eco-sr-only"
          tabIndex={-1}
          onChange={(event) => onMeterImage(event, meterVisionType)}
        />

        <div className="eco-row">
          <button type="button" className="eco-btn eco-btn-primary" onClick={() => fileCamRef.current?.click()}>
            <Camera size={16} /> Take photo
          </button>
          <button type="button" className="eco-btn eco-btn-secondary" onClick={() => fileGalRef.current?.click()}>
            <ImageIcon size={16} /> Upload from gallery
          </button>
        </div>

        {meterVisionBusy ? <Alert variant="info">Analysing the image…</Alert> : null}

        {meterVisionPreview ? (
          <img src={meterVisionPreview} alt="Meter preview" className="eco-meter-preview" />
        ) : null}

        {attempted && outcome.reading != null ? (
          <Alert variant="success">
            Suggested reading <strong>{outcome.reading}</strong> units — filled into the {label.toLowerCase()}{' '}
            field as an editable value. Please check this reading against the physical meter before saving.
            {outcome.confidence != null ? (
              <span className="eco-small eco-muted"> (OCR confidence {outcome.confidence}%)</span>
            ) : null}
          </Alert>
        ) : null}

        {attempted && outcome.reading == null ? (
          <Alert variant="warn">
            We couldn&apos;t read a number from that photo.
            {outcome.reason ? ` ${outcome.reason}` : ''} Please check the display is well lit and in focus, or
            enter the reading manually.
          </Alert>
        ) : null}
      </div>
    </Modal>
  )
}
