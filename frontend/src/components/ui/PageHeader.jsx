/**
 * Standard page heading used by every internal page: optional breadcrumbs, an eyebrow
 * label, the title, a supporting description and a right-aligned action slot.
 *
 * Having a single component for this is what keeps the headings identical in size,
 * spacing and alignment from page to page.
 */
export function PageHeader({ eyebrow, title, description, breadcrumbs, actions, icon: Icon }) {
  return (
    <header className="eco-page-head">
      <div className="eco-page-head-lead">
        {breadcrumbs?.length ? (
          <nav className="eco-breadcrumb" aria-label="Breadcrumb">
            {breadcrumbs.map((crumb, index) => (
              <span key={crumb.label} className="eco-row" style={{ gap: 7 }}>
                {index > 0 ? <span className="eco-breadcrumb-sep">/</span> : null}
                {crumb.onClick && index < breadcrumbs.length - 1 ? (
                  <button type="button" onClick={crumb.onClick}>
                    {crumb.label}
                  </button>
                ) : (
                  <span className={index === breadcrumbs.length - 1 ? 'eco-breadcrumb-current' : undefined}>
                    {crumb.label}
                  </span>
                )}
              </span>
            ))}
          </nav>
        ) : null}

        {eyebrow ? (
          <span className="eco-page-eyebrow">
            {Icon ? <Icon size={13} /> : null}
            {eyebrow}
          </span>
        ) : null}

        <h1 className="eco-page-title">{title}</h1>
        {description ? <p className="eco-page-desc">{description}</p> : null}
      </div>

      {actions ? <div className="eco-page-actions">{actions}</div> : null}
    </header>
  )
}
