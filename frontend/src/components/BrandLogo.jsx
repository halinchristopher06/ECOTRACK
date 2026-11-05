import { useTheme } from '../hooks/useTheme.js'

/**
 * Official EcoTrack brand lockups.
 *
 * The supplied artwork ships as two plated pairs: a dark-plate lockup (light wordmark) meant for
 * dark surfaces and a light-plate lockup (dark wordmark) meant for light surfaces. `logo.png` is
 * the only fully transparent file, so it is kept as the emergency fallback rather than a
 * primary asset.
 */
const FULL_SRC = {
  light: '/assets/brand/logo-light.png',
  dark: '/assets/brand/logo-dark.png',
}

const ICON_SRC = {
  light: '/assets/brand/icon-light.png',
  dark: '/assets/brand/icon-dark.png',
}

const FALLBACK_SRC = '/assets/brand/logo.png'

/**
 * Renders the official EcoTrack logo.
 *
 * @param {'full'|'icon'} [variant]  Full lockup (mark + wordmark) or the square mark only.
 * @param {'light'|'dark'} [tone]    Tone of the surface the logo sits on. Omit to follow the
 *                                   active app theme, which is what keeps the logo in sync when
 *                                   the user toggles light/dark (no reload needed). Pass an
 *                                   explicit tone on surfaces that are dark in *both* themes,
 *                                   such as the footer and the auth branding panel.
 * @param {number|string} [size]     Rendered height, in px when a number. Width follows the
 *                                   artwork's own aspect ratio, so the logo is never stretched.
 * @param {boolean} [responsive]     Render both lockups and let CSS pick: full lockup normally,
 *                                   square mark below the mobile breakpoint.
 * @param {string} [alt]             Image alt text. Pass '' when an ancestor already labels the
 *                                   brand (e.g. a button with aria-label).
 */
export function BrandLogo({
  variant = 'full',
  tone,
  size,
  responsive = false,
  className = '',
  alt = 'EcoTrack logo',
  ...rest
}) {
  const { theme } = useTheme()
  const surface = tone === 'light' || tone === 'dark' ? tone : theme === 'dark' ? 'dark' : 'light'

  const style = size ? { '--eco-logo-h': typeof size === 'number' ? `${size}px` : size } : undefined

  // The official artwork is expected to be present; if a file is ever missing we fall back to the
  // transparent lockup instead of showing a broken image.
  const handleError = (event) => {
    const image = event.currentTarget
    if (image.getAttribute('src') === FALLBACK_SRC) return
    image.src = FALLBACK_SRC
  }

  if (responsive) {
    return (
      <span className={`eco-logo-set ${className}`.trim()} style={style}>
        <img
          className="eco-logo eco-logo-full"
          src={FULL_SRC[surface]}
          alt={alt}
          onError={handleError}
          {...rest}
        />
        <img
          className="eco-logo eco-logo-compact"
          src={ICON_SRC[surface]}
          alt={alt}
          onError={handleError}
          {...rest}
        />
      </span>
    )
  }

  return (
    <img
      className={`eco-logo ${className}`.trim()}
      style={style}
      src={variant === 'icon' ? ICON_SRC[surface] : FULL_SRC[surface]}
      alt={alt}
      onError={handleError}
      {...rest}
    />
  )
}
