import { Check } from 'lucide-react'
import { BrandLogo } from '../BrandLogo.jsx'
import { ThemeToggle } from '../ThemeToggle.jsx'

/**
 * The left-hand branding panel shared by the sign-in and sign-up screens.
 *
 * It exists so both auth pages carry the same EcoTrack identity — the brand mark, the
 * promise and the proof points — instead of the generic third-party styling the pages
 * used to copy. Content is passed in so each screen can say something relevant without
 * duplicating the layout.
 */
export function AuthAside({ title, lead, points = [], quote, showThemeToggle = true }) {
  return (
    <aside className="eco-auth-aside">
      <div className="eco-auth-aside-inner">
        {/* This panel is navy in both themes, so the dark-plate lockup is used explicitly. */}
        <BrandLogo size={56} tone="dark" />

        <h2 className="eco-auth-aside-title">{title}</h2>
        <p className="eco-auth-aside-lead">{lead}</p>

        {points.length ? (
          <ul className="eco-auth-aside-list">
            {points.map((point) => (
              <li key={point}>
                <span className="eco-auth-aside-check" aria-hidden="true">
                  <Check size={14} />
                </span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {quote ? (
          <div className="eco-auth-aside-quote">
            <strong>{quote.value}</strong>
            {quote.label}
          </div>
        ) : null}

        {showThemeToggle ? (
          <div className="eco-auth-theme-row">
            <ThemeToggle />
            <span>Light and dark, both designed.</span>
          </div>
        ) : null}
      </div>
    </aside>
  )
}
