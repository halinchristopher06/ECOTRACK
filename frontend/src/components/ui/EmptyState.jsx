import { Inbox } from 'lucide-react'

/**
 * Shown whenever a list, chart or table has no data.
 *
 * Every data-driven area of the app uses this instead of rendering an empty or broken
 * container, so a user with no bills yet sees an explanation and a next step rather than
 * a blank panel.
 */
export function EmptyState({ icon: Icon = Inbox, title, text, actions }) {
  return (
    <div className="eco-empty">
      <span className="eco-empty-icon">
        <Icon size={24} aria-hidden="true" />
      </span>
      <h3 className="eco-empty-title">{title}</h3>
      {text ? <p className="eco-empty-text">{text}</p> : null}
      {actions ? <div className="eco-empty-actions">{actions}</div> : null}
    </div>
  )
}

export function Skeleton({ className = '', style }) {
  return <div className={`eco-skel ${className}`.trim()} style={style} aria-hidden="true" />
}

/** Placeholder block with a configurable number of text lines and/or a chart area. */
export function SkeletonCard({ lines = 3, block = false }) {
  return (
    <div aria-hidden="true">
      <Skeleton className="eco-skel-title" />
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          className="eco-skel-line"
          style={{ width: `${92 - index * 11}%` }}
        />
      ))}
      {block ? <Skeleton className="eco-skel-block" style={{ marginTop: 14 }} /> : null}
    </div>
  )
}
