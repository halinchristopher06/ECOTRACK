import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart3,
  CalendarRange,
  CreditCard,
  Download,
  Droplets,
  FileSpreadsheet,
  FileText,
  Lock,
  PlugZap,
  Receipt,
  Zap,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth.js'
import {
  downloadAnnualReport,
  downloadApplianceReport,
  downloadBillsReport,
  downloadPaymentHistoryReport,
  triggerBlobDownload,
} from '../services/reportService.js'
import { PageHeader } from '../components/ui/PageHeader.jsx'
import { Card } from '../components/ui/Card.jsx'
import { Alert } from '../components/ui/Alert.jsx'
import { EmptyState } from '../components/ui/EmptyState.jsx'
import { LoadingButton } from '../components/LoadingButton.jsx'

const FORMAT_OPTIONS = [
  { value: 'excel', label: 'Excel', icon: FileSpreadsheet },
  { value: 'pdf', label: 'PDF', icon: FileText },
]

function FormatToggle({ format, setFormat }) {
  return (
    <div className="eco-tabs" role="group" aria-label="Export format" style={{ margin: 0 }}>
      {FORMAT_OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          className={`eco-tab ${format === value ? 'is-active' : ''}`.trim()}
          aria-pressed={format === value}
          onClick={() => setFormat(value)}
        >
          <Icon size={15} aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  )
}

function ReportCard({ icon, title, description, busy, onDownload, children }) {
  return (
    <Card icon={icon} title={title} subtitle={description}>
      <div className="eco-report-controls">
        <div className="eco-report-formats">{children}</div>
        <LoadingButton
          className="eco-btn eco-btn-primary eco-report-download"
          loading={busy}
          loadingText="Preparing…"
          onClick={onDownload}
        >
          <Download size={16} aria-hidden="true" />
          Download
        </LoadingButton>
      </div>
    </Card>
  )
}

export function ReportsPage() {
  const navigate = useNavigate()
  const { token, setAuthMessage, setAuthError } = useAuth()
  const [busyKey, setBusyKey] = useState('')
  const [elecFormat, setElecFormat] = useState('excel')
  const [waterFormat, setWaterFormat] = useState('excel')
  const [combinedFormat, setCombinedFormat] = useState('excel')
  const [applianceFormat, setApplianceFormat] = useState('excel')
  const [paymentFormat, setPaymentFormat] = useState('excel')
  const [annualFormat, setAnnualFormat] = useState('excel')
  const [annualYear, setAnnualYear] = useState(new Date().getFullYear())

  const run = async (key, fn, filename) => {
    if (busyKey) return
    setBusyKey(key)
    try {
      const blob = await fn()
      triggerBlobDownload(blob, filename)
      setAuthMessage('Report downloaded successfully')
      setAuthError(false)
    } catch (err) {
      setAuthMessage(err.message)
      setAuthError(true)
    } finally {
      setBusyKey('')
    }
  }

  const ext = (format) => (format === 'pdf' ? 'pdf' : 'xlsx')

  const header = (
    <PageHeader
      breadcrumbs={[
        { label: 'Overview', onClick: () => navigate('/dashboard') },
        { label: 'Reports' },
      ]}
      eyebrow="Exports"
      icon={BarChart3}
      title="Reports & exports"
      description="Download your own bills, appliances, payments and yearly summaries as an Excel workbook or a PDF."
    />
  )

  if (!token) {
    return (
      <div>
        {header}
        <Card>
          <EmptyState
            icon={Lock}
            title="Sign in required"
            text="Log in to download your personal reports."
          />
        </Card>
      </div>
    )
  }

  return (
    <div>
      {header}

      <div className="eco-stack">
        <Alert variant="info">
          Each report below covers only your own bills and appliances. Pick Excel or PDF, then download.
        </Alert>

        <div className="eco-grid eco-grid-2">
          <ReportCard
            icon={Zap}
            title="Monthly electricity report"
            description="All your electricity bills with units, amounts and payment status."
            busy={busyKey === 'elec'}
            onDownload={() =>
              run('elec', () => downloadBillsReport(token, { utilityType: 'ELECTRICITY', format: elecFormat }), `electricity-report.${ext(elecFormat)}`)
            }
          >
            <FormatToggle format={elecFormat} setFormat={setElecFormat} />
          </ReportCard>

          <ReportCard
            icon={Droplets}
            title="Monthly water report"
            description="All your water bills with units, amounts and payment status."
            busy={busyKey === 'water'}
            onDownload={() =>
              run('water', () => downloadBillsReport(token, { utilityType: 'WATER', format: waterFormat }), `water-report.${ext(waterFormat)}`)
            }
          >
            <FormatToggle format={waterFormat} setFormat={setWaterFormat} />
          </ReportCard>

          <ReportCard
            icon={Receipt}
            title="Combined expense report"
            description="Every bill across all utility types in one report."
            busy={busyKey === 'combined'}
            onDownload={() =>
              run('combined', () => downloadBillsReport(token, { format: combinedFormat }), `combined-expenses.${ext(combinedFormat)}`)
            }
          >
            <FormatToggle format={combinedFormat} setFormat={setCombinedFormat} />
          </ReportCard>

          <ReportCard
            icon={PlugZap}
            title="Appliance expense report"
            description="Per-appliance wattage, usage and monthly/annual cost breakdown."
            busy={busyKey === 'appliance'}
            onDownload={() =>
              run('appliance', () => downloadApplianceReport(token, { format: applianceFormat }), `appliance-report.${ext(applianceFormat)}`)
            }
          >
            <FormatToggle format={applianceFormat} setFormat={setApplianceFormat} />
          </ReportCard>

          <ReportCard
            icon={CreditCard}
            title="Payment history"
            description="Bill amounts, due dates, payment status and payment dates."
            busy={busyKey === 'payment'}
            onDownload={() =>
              run('payment', () => downloadPaymentHistoryReport(token, { format: paymentFormat }), `payment-history.${ext(paymentFormat)}`)
            }
          >
            <FormatToggle format={paymentFormat} setFormat={setPaymentFormat} />
          </ReportCard>

          <ReportCard
            icon={CalendarRange}
            title="Annual report"
            description="All bills for a chosen year, grouped by month with a yearly total."
            busy={busyKey === 'annual'}
            onDownload={() =>
              run('annual', () => downloadAnnualReport(token, { year: annualYear, format: annualFormat }), `annual-report-${annualYear}.${ext(annualFormat)}`)
            }
          >
            <label className="eco-report-year">
              <span className="eco-label">Year</span>
              <input
                type="number"
                className="eco-input eco-input-compact eco-input-year"
                value={annualYear}
                onChange={(e) => setAnnualYear(Number(e.target.value) || new Date().getFullYear())}
                aria-label="Report year"
              />
            </label>
            <FormatToggle format={annualFormat} setFormat={setAnnualFormat} />
          </ReportCard>
        </div>
      </div>
    </div>
  )
}
