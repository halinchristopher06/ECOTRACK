/**
 * Surface primitive. Passing `title`/`actions`/`footer` builds the standard card chrome;
 * omitting them gives a plain padded panel. `padded={false}` is used when the body is a
 * table or a full-bleed chart that manages its own spacing.
 */
export function Card({
  title,
  subtitle,
  icon: Icon,
  actions,
  footer,
  hover = false,
  padded = true,
  className = '',
  bodyClassName = '',
  children,
}) {
  const hasHead = Boolean(title || actions)

  return (
    <section className={`eco-card ${hover ? 'eco-card-hover' : ''} ${className}`.trim()}>
      {hasHead ? (
        <div className="eco-card-head">
          <div>
            <h3 className="eco-card-title">
              {Icon ? <Icon size={17} aria-hidden="true" /> : null}
              {title}
            </h3>
            {subtitle ? <p className="eco-card-sub">{subtitle}</p> : null}
          </div>
          {actions ? <div className="eco-page-actions">{actions}</div> : null}
        </div>
      ) : null}

      <div className={`${padded ? 'eco-card-body' : ''} ${bodyClassName}`.trim()}>{children}</div>

      {footer ? <div className="eco-card-foot">{footer}</div> : null}
    </section>
  )
}
