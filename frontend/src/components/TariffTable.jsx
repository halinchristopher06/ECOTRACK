import { Droplets, Zap } from 'lucide-react'
import { Badge, ProgressBar } from './ui/Badge.jsx'
import { EmptyState } from './ui/EmptyState.jsx'

/** "0 – 100 kWh" for a capped slab, "Above previous slab" for the open-ended top slab. */
function slabRange(slab, unitLabel) {
  return slab.upto == null ? 'Above previous slab' : `0 – ${slab.upto} ${unitLabel}`
}

function SlabTable({ tariffs, maxRate, tone, unitLabel, slabHeader }) {
  const peakRate = Number.isFinite(maxRate) && maxRate > 0 ? maxRate : 1

  return (
    <div className="eco-table-wrap">
      <table className="eco-table">
        <thead>
          <tr>
            <th>{slabHeader}</th>
            <th className="eco-table-num">Rate</th>
            <th>Amount</th>
          </tr>
        </thead>
        {tariffs.map((tariff) => (
          <tbody key={tariff.company}>
            <tr>
              <td colSpan={3} style={{ background: 'var(--color-bg-alt)' }}>
                <span className="eco-list-title">{tariff.company}</span>
                <span className="eco-muted eco-small">
                  {' '}
                  · {tariff.consumer} · {tariff.unit}
                </span>
              </td>
            </tr>
            {tariff.slabs.map((slab, index) => {
              const isPeak = slab.rate === maxRate
              return (
                <tr
                  key={index}
                  style={
                    isPeak
                      ? { background: tone === 'water' ? 'var(--color-water-soft)' : 'var(--color-primary-soft)' }
                      : undefined
                  }
                >
                  <td>{slabRange(slab, unitLabel)}</td>
                  <td className="eco-table-num">₹{slab.rate.toFixed(2)}</td>
                  <td style={{ minWidth: 150 }}>
                    <ProgressBar value={(100 * slab.rate) / peakRate} tone={tone} />
                  </td>
                </tr>
              )
            })}
            <tr>
              <td colSpan={3}>
                <span className="eco-muted eco-small" style={{ fontStyle: 'italic' }}>
                  {tariff.note}
                </span>
              </td>
            </tr>
          </tbody>
        ))}
      </table>
    </div>
  )
}

/**
 * Shared slab-tariff table. It has no outer padding of its own so the same markup renders
 * correctly inside a card body, a full-bleed card body and the tariff modal body, which all
 * provide their own spacing.
 */
export function TariffTable({ electricityTariffs, waterTariffs, maxElecTariffRate, maxWaterTariffRate }) {
  const electricity = Array.isArray(electricityTariffs) ? electricityTariffs : []
  const water = Array.isArray(waterTariffs) ? waterTariffs : []
  const hasElectricity = electricity.length > 0
  const hasWater = water.length > 0

  if (!hasElectricity && !hasWater) {
    return (
      <EmptyState
        icon={Zap}
        title="No tariff data available"
        text="Electricity and water slab rates will appear here once the tariff catalogue is published."
      />
    )
  }

  // Each surrounding card already carries the heading when a single utility is rendered (the
  // landing-page tariff cards and the two cards on the tariffs page), so the in-table heading is
  // only shown when both utilities are rendered together — as they are inside the tariff modal.
  const showHeadings = hasElectricity && hasWater

  return (
    <div className="eco-stack">
      {hasElectricity ? (
        <section className="tariff-section">
          {showHeadings ? (
            <div className="eco-form-section-title">
              <Badge tone="primary" icon={Zap}>
                Electricity
              </Badge>
              <span className="eco-muted eco-small">Energy charge slabs per kWh</span>
            </div>
          ) : null}
          <SlabTable
            tariffs={electricity}
            maxRate={maxElecTariffRate}
            tone="brand"
            unitLabel="kWh"
            slabHeader="Monthly units (kWh) slab"
          />
        </section>
      ) : null}

      {hasWater ? (
        <section className="tariff-section">
          {showHeadings ? (
            <div className="eco-form-section-title">
              <Badge tone="water" icon={Droplets}>
                Water
              </Badge>
              <span className="eco-muted eco-small">Domestic slab rates per kilolitre</span>
            </div>
          ) : null}
          <SlabTable
            tariffs={water}
            maxRate={maxWaterTariffRate}
            tone="water"
            unitLabel="kl/mo"
            slabHeader="Consumption slab"
          />
        </section>
      ) : null}
    </div>
  )
}
