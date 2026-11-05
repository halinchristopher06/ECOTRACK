import { Calculator, Droplets, Gauge, ScanLine, Zap } from 'lucide-react'
import { useAuth } from '../hooks/useAuth.js'
import { useAppState } from '../hooks/useAppState.js'
import { MeterVisionModal } from '../components/modals/MeterVisionModal.jsx'
import { UsageBarChart } from '../components/charts/UsageBarChart.jsx'
import { PageHeader } from '../components/ui/PageHeader.jsx'
import { Card } from '../components/ui/Card.jsx'
import { Alert } from '../components/ui/Alert.jsx'
import { TextField } from '../components/ui/Field.jsx'

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 })

function formatMoney(value) {
  return money.format(Number.isFinite(value) ? value : 0)
}

export function ManualCheckerPage() {
  const { setAuthMessage } = useAuth()
  const {
    billingEstimate,
    billingBusy,
    billingError,
    rate,
    elecUnits,
    setElecUnits,
    waterUnits,
    setWaterUnits,
    elecEstimate,
    waterEstimate,
    recordMonth,
    setRecordMonth,
    saveReadingsToHistory,
    meterVisionOpen,
    meterVisionType,
    setMeterVisionType,
    meterVisionPreview,
    meterVisionReading,
    meterVisionBusy,
    fileCamRef,
    fileGalRef,
    openMeterVision,
    closeMeterVision,
    onMeterImage,
    oddMonthSpan,
    setOddMonthSpan,
    usageChartPoints,
  } = useAppState()

  const handleSave = () => saveReadingsToHistory(elecUnits, waterUnits, setAuthMessage)

  return (
    <div>
      {meterVisionOpen && (
        <MeterVisionModal
          meterVisionType={meterVisionType}
          setMeterVisionType={setMeterVisionType}
          meterVisionBusy={meterVisionBusy}
          meterVisionPreview={meterVisionPreview}
          meterVisionReading={meterVisionReading}
          onClose={closeMeterVision}
          onMeterImage={onMeterImage}
          fileCamRef={fileCamRef}
          fileGalRef={fileGalRef}
        />
      )}

      <PageHeader
        breadcrumbs={[{ label: 'Overview' }, { label: 'Bill calculator' }]}
        eyebrow="Estimator"
        title="Bill calculator"
        description="Type in meter units — or read them straight off a photo — and EcoTrack prices them with the live slab tariffs."
        icon={Calculator}
      />

      <div className="eco-stack">
        <div className="eco-grid eco-grid-2">
          <Card
            title="Electricity"
            subtitle={billingEstimate.electricity?.tariffName || 'Live slab tariff'}
            icon={Zap}
          >
            <TextField
              label="Units consumed (kWh)"
              type="number"
              min="0"
              step="0.01"
              placeholder="0"
              value={elecUnits}
              onChange={(event) => setElecUnits(event.target.value)}
              help={`Current average rate: ₹${rate.electricity.toFixed(2)} per kWh`}
            />
            <div className="eco-summary-row">
              <span>Estimated electricity charge</span>
              <span className="eco-summary-value">{formatMoney(elecEstimate)}</span>
            </div>
          </Card>

          <Card title="Water" subtitle={billingEstimate.water?.tariffName || 'Live slab tariff'} icon={Droplets}>
            <TextField
              label="Units consumed (kl)"
              type="number"
              min="0"
              step="0.01"
              placeholder="0"
              value={waterUnits}
              onChange={(event) => setWaterUnits(event.target.value)}
              help={`Current average rate: ₹${rate.water.toFixed(2)} per kl`}
            />
            <div className="eco-summary-row">
              <span>Estimated water charge</span>
              <span className="eco-summary-value">{formatMoney(waterEstimate)}</span>
            </div>
          </Card>
        </div>

        <Card title="Combined estimate" icon={Gauge}>
          {billingError ? (
            <Alert variant="error" className="eco-card-gap">
              {billingError}
            </Alert>
          ) : null}

          <div className="eco-summary-row">
            <span>Electricity — {elecUnits || 0} kWh</span>
            <span className="eco-summary-value">{formatMoney(elecEstimate)}</span>
          </div>
          <div className="eco-summary-row">
            <span>Water — {waterUnits || 0} kl</span>
            <span className="eco-summary-value">{formatMoney(waterEstimate)}</span>
          </div>
          <div className="eco-summary-row is-total">
            <span>Combined estimate</span>
            <span className="eco-summary-value">{formatMoney(billingEstimate.total)}</span>
          </div>

          <div className="eco-field-row eco-card-gap">
            <TextField
              label="Month for saved history"
              type="month"
              value={recordMonth}
              onChange={(event) => setRecordMonth(event.target.value)}
              help="Saved locally on this device and shown on the chart below."
            />
            <div className="eco-field">
              <span className="eco-label">Keep this month</span>
              <button type="button" className="eco-btn eco-btn-secondary" onClick={handleSave}>
                Save units to history
              </button>
            </div>
          </div>

          {billingBusy ? (
            <p className="eco-small eco-muted" style={{ margin: 0 }}>
              Refreshing the estimate with the latest tariffs…
            </p>
          ) : null}
        </Card>

        <Card
          title="Read a meter from a photo"
          subtitle="Snap the display and EcoTrack fills the matching units field for you."
          icon={ScanLine}
        >
          <div className="eco-between">
            <p className="eco-small eco-soft" style={{ margin: 0, maxWidth: '62ch' }}>
              Photograph the digital display of your electricity or water meter. You choose which meter it is in the
              popup, so the suggested reading lands in the right field — always check it before saving.
            </p>
            <button type="button" className="eco-btn eco-btn-primary" onClick={() => openMeterVision('electric')}>
              <ScanLine size={16} /> Open meter reader
            </button>
          </div>
        </Card>

        <UsageBarChart
          oddMonthSpan={oddMonthSpan}
          setOddMonthSpan={setOddMonthSpan}
          usageChartPoints={usageChartPoints}
        />
      </div>
    </div>
  )
}
