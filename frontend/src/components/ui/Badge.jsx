/** Small status pill. `tone` picks the colour family, matching the design tokens. */
export function Badge({ tone = 'default', icon: Icon, children, className = '' }) {
  return (
    <span className={`eco-badge ${tone !== 'default' ? `is-${tone}` : ''} ${className}`.trim()}>
      {Icon ? <Icon size={12} aria-hidden="true" /> : null}
      {children}
    </span>
  )
}

/** Labelled progress bar with an optional tone override (`water`, `warn`, `danger`). */
export function ProgressBar({ value, tone = 'brand', label, valueLabel }) {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0))

  return (
    <div>
      {label || valueLabel ? (
        <div className="eco-progress-label">
          <span>{label}</span>
          <span className="eco-mono">{valueLabel}</span>
        </div>
      ) : null}
      <div
        className="eco-progress"
        role="progressbar"
        aria-valuenow={Math.round(clamped)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || 'Progress'}
      >
        <div
          className={`eco-progress-bar ${tone !== 'brand' ? `is-${tone}` : ''}`.trim()}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  )
}

/** Read-only inline metric, used inside card headers and summaries. */
export function InlineMetric({ value, label }) {
  return (
    <span className="eco-kpi-inline">
      <strong>{value}</strong>
      <span>{label}</span>
    </span>
  )
}
