import { loadSessionToken } from './storage.js'
import { readMeterPhoto } from '../services/ocrService.js'

/**
 * A meter reading suggested from a photo, together with whatever the OCR pass could tell us about
 * how reliable it is.
 *
 * It is deliberately stringifiable: the long-standing consumer of this module stores the result and
 * does `String(reading)` to fill the units field, so `toString()` yields the digits (or an empty
 * string when nothing was read). That keeps the old single-number contract working while newer UI
 * can read the confidence and the reason a photo could not be read.
 */
export class MeterReading {
  constructor({ reading = null, confidence = null, rawText = '', ocrAvailable = true, reason = '' } = {}) {
    this.reading = Number.isFinite(reading) ? reading : null
    this.confidence = Number.isFinite(confidence) ? confidence : null
    this.rawText = rawText || ''
    this.ocrAvailable = ocrAvailable !== false
    this.reason = reason || ''
  }

  toString() {
    return this.reading == null ? '' : String(this.reading)
  }
}

/**
 * Suggests a meter reading from a photo via the server's OCR endpoint.
 *
 * Never throws: a slow or failing OCR call resolves to a {@link MeterReading} with `reading: null`
 * and a human-readable reason, so the caller can never freeze or end up with an invented number.
 *
 * @param file the meter photo chosen by the user
 */
export async function estimateUnitsFromImage(file) {
  try {
    const result = await readMeterPhoto(file, undefined, loadSessionToken())
    return new MeterReading(result || {})
  } catch (err) {
    return new MeterReading({
      ocrAvailable: false,
      reason: err?.message || 'The meter photo could not be read right now. You can type the reading in manually.',
    })
  }
}
