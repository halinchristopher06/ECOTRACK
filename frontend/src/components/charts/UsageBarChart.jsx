import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BarChart3 } from 'lucide-react'
import { useTheme } from '../../hooks/useTheme.js'
import { chartThemeFor } from '../../utils/chartTheme.js'
import { Card } from '../ui/Card.jsx'
import { EmptyState } from '../ui/EmptyState.jsx'

/**
 * Saved what-if readings recorded on the bill calculator page. Uses Recharts so it matches the
 * dashboard charts, and the palette is resolved from the live theme because SVG attributes
 * cannot read CSS custom properties.
 */
export function UsageBarChart({ oddMonthSpan, setOddMonthSpan, usageChartPoints }) {
  const { theme } = useTheme()
  const { palette, tooltipStyle, axisProps } = chartThemeFor(theme)
  const points = usageChartPoints || []
  const hasData = points.some((point) => (Number(point.electric) || 0) > 0 || (Number(point.water) || 0) > 0)

  return (
    <Card
      title="Usage by month"
      subtitle="Odd months only (Jan, Mar, May, Jul, Sep, Nov). These are the readings you saved here — your uploaded bills on the dashboard are tracked separately."
      icon={BarChart3}
      actions={
        <select
          className="eco-select"
          style={{ width: 'auto', minWidth: 132 }}
          value={oddMonthSpan}
          onChange={(event) => setOddMonthSpan(Number(event.target.value))}
          aria-label="Number of odd months to show"
        >
          {[3, 6, 9, 12].map((count) => (
            <option key={count} value={count}>
              {count} months
            </option>
          ))}
        </select>
      }
    >
      {hasData ? (
        <div className="eco-grid eco-grid-2">
          <div>
            <p className="eco-chart-label">Electricity (kWh)</p>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={points} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} vertical={false} />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis {...axisProps} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: palette.tooltipText }}
                  cursor={{ fill: palette.grid }}
                />
                <Bar
                  dataKey="electric"
                  name="Electricity (kWh)"
                  fill={palette.electricity}
                  radius={[5, 5, 0, 0]}
                  maxBarSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div>
            <p className="eco-chart-label">Water (kl)</p>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={points} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} vertical={false} />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis {...axisProps} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: palette.tooltipText }}
                  cursor={{ fill: palette.grid }}
                />
                <Bar
                  dataKey="water"
                  name="Water (kl)"
                  fill={palette.water}
                  radius={[5, 5, 0, 0]}
                  maxBarSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <EmptyState
          icon={BarChart3}
          title="No saved readings yet"
          text="Enter your units above and use “Save units to history” — the month will appear on these charts."
        />
      )}
    </Card>
  )
}
