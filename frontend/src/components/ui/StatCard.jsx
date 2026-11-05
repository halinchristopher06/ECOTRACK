import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react'

const TREND_ICON = { up: ArrowUpRight, down: ArrowDownRight, flat: ArrowRight }

/**
 * Headline metric tile. `tone` switches the accent stripe and icon colour so electricity
 * (green), water (blue) and cost (earth) cards are distinguishable at a glance.
 */
export function StatCard({ label, value, meta, icon: Icon, tone = 'brand', trend }) {
  const TrendIcon = trend ? TREND_ICON[trend.direction] || ArrowRight : null

  return (
    <article className={`eco-stat ${tone !== 'brand' ? `is-${tone}` : ''}`.trim()}>
      <div className="eco-stat-top">
        <span className="eco-stat-label">{label}</span>
        {Icon ? (
          <span className="eco-stat-icon">
            <Icon size={17} aria-hidden="true" />
          </span>
        ) : null}
      </div>

      <div className="eco-stat-value">{value}</div>

      {trend || meta ? (
        <div className="eco-stat-meta">
          {trend ? (
            <span className={`eco-trend is-${trend.direction}`}>
              {TrendIcon ? <TrendIcon size={13} aria-hidden="true" /> : null}
              {trend.text}
            </span>
          ) : null}
          {meta ? <span>{meta}</span> : null}
        </div>
      ) : null}
    </article>
  )
}
