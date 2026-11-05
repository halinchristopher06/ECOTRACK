import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { ThemeToggle } from '../components/ThemeToggle.jsx'
import { BrandLogo } from '../components/BrandLogo.jsx'

/**
 * Links to each landing-page section. The `hash` doubles as the scroll target id, so the
 * scroll-spy below can highlight whichever section is currently on screen.
 */
const NAV_LINKS = [
  { label: 'Home', hash: '' },
  { label: 'Features', hash: '#features' },
  { label: 'How it works', hash: '#how' },
  { label: 'Tariffs', hash: '#tariffs' },
  { label: 'Savings', hash: '#saving' },
  { label: 'About', hash: '#about' },
]

export function PublicLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  // Seeded from the live scroll position so a deep link (/#features) starts in the right state.
  const [scrolled, setScrolled] = useState(() => typeof window !== 'undefined' && window.scrollY > 8)
  const [activeSection, setActiveSection] = useState('')

  const isLanding = location.pathname === '/'

  // Solid/blurred navbar once the page has moved — purely additive, the navbar is always sticky.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Scroll-spy: marks the section currently occupying the middle of the viewport.
  useEffect(() => {
    if (!isLanding || typeof IntersectionObserver === 'undefined') return undefined
    const nodes = NAV_LINKS.map((link) => (link.hash ? document.querySelector(link.hash) : null)).filter(Boolean)
    if (nodes.length === 0) return undefined

    const observer = new IntersectionObserver(
      (entries) => {
        const onScreen = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        setActiveSection(onScreen.length > 0 ? `#${onScreen[0].target.id}` : '')
      },
      { rootMargin: '-30% 0px -55% 0px', threshold: [0, 0.2, 0.5, 1] },
    )
    nodes.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [isLanding])

  // Drawer behaviour: Escape closes it and the page behind it cannot scroll.
  useEffect(() => {
    if (!menuOpen) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [menuOpen])

  const goToSection = (hash) => {
    setMenuOpen(false)
    if (!isLanding) {
      navigate(`/${hash}`)
      return
    }
    if (!hash) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const go = (path) => {
    setMenuOpen(false)
    navigate(path)
  }

  const isActive = (hash) => {
    if (hash) return activeSection === hash
    // "Home" is active at the top of the landing page and on any non-landing public route.
    return isLanding ? activeSection === '' : true
  }

  return (
    <div className="eco-shell">
      <header className={`eco-navbar ${scrolled || menuOpen ? 'is-scrolled' : ''}`.trim()}>
        <div className="eco-navbar-inner">
          <button type="button" className="eco-brand" onClick={() => goToSection('')} aria-label="EcoTrack — home">
            <BrandLogo size={46} responsive alt="" />
          </button>

          <nav className="eco-nav-links" aria-label="Main navigation">
            {NAV_LINKS.map((link) => (
              <button
                key={link.label}
                type="button"
                className={`eco-nav-link ${isActive(link.hash) ? 'is-active' : ''}`.trim()}
                aria-current={isActive(link.hash) ? 'page' : undefined}
                onClick={() => goToSection(link.hash)}
              >
                {link.label}
              </button>
            ))}
          </nav>

          <div className="eco-nav-actions eco-nav-actions-desktop">
            <ThemeToggle />
            <button type="button" className="eco-btn eco-btn-secondary eco-btn-sm" onClick={() => go('/login')}>
              Sign in
            </button>
            <button type="button" className="eco-btn eco-btn-primary eco-btn-sm" onClick={() => go('/signup')}>
              Get started
            </button>
          </div>

          <button
            type="button"
            className="eco-nav-toggle"
            aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((value) => !value)}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {menuOpen ? (
        <>
          <div className="eco-drawer-backdrop" onClick={() => setMenuOpen(false)} role="presentation" />
          <aside className="eco-drawer-panel" aria-label="Navigation">
            <div className="eco-drawer-head">
              <span className="eco-brand" style={{ cursor: 'default' }}>
                <BrandLogo size={38} />
              </span>
              <button type="button" className="eco-icon-btn" onClick={() => setMenuOpen(false)} aria-label="Close navigation">
                <X size={18} />
              </button>
            </div>

            {NAV_LINKS.map((link) => (
              <button
                key={link.label}
                type="button"
                className={`eco-drawer-link ${isActive(link.hash) ? 'is-active' : ''}`.trim()}
                onClick={() => goToSection(link.hash)}
              >
                {link.label}
              </button>
            ))}

            <div className="eco-drawer-foot">
              <div className="eco-row" style={{ justifyContent: 'space-between' }}>
                <span className="eco-help">Appearance</span>
                <ThemeToggle />
              </div>
              <button type="button" className="eco-btn eco-btn-secondary eco-btn-block" onClick={() => go('/login')}>
                Sign in
              </button>
              <button type="button" className="eco-btn eco-btn-primary eco-btn-block" onClick={() => go('/signup')}>
                Get started free
              </button>
            </div>
          </aside>
        </>
      ) : null}

      <main className="eco-main">
        <div key={location.pathname} className="page-fade">
          <Outlet />
        </div>
      </main>

      <footer className="eco-footer">
        <div className="eco-footer-inner">
          <div className="eco-footer-brand">
            {/* The footer is navy in both themes, so the dark-plate lockup is used explicitly. */}
            <BrandLogo size={42} tone="dark" />
            <p>
              One calm, clear place to understand your electricity and water costs, plan ahead and cut what you
              do not need.
            </p>
          </div>

          <div className="eco-footer-col">
            <h4>Product</h4>
            <button type="button" onClick={() => goToSection('#features')}>
              Features
            </button>
            <button type="button" onClick={() => goToSection('#how')}>
              How it works
            </button>
            <button type="button" onClick={() => goToSection('#preview')}>
              Dashboard preview
            </button>
            <button type="button" onClick={() => goToSection('#saving')}>
              Saving playbook
            </button>
          </div>

          <div className="eco-footer-col">
            <h4>Tariffs</h4>
            <button type="button" onClick={() => goToSection('#tariffs-electricity')}>
              Electricity tariffs
            </button>
            <button type="button" onClick={() => goToSection('#tariffs-water')}>
              Water tariffs
            </button>
            <button type="button" onClick={() => goToSection('#impact')}>
              Environmental impact
            </button>
          </div>

          <div className="eco-footer-col">
            <h4>Account</h4>
            <button type="button" onClick={() => go('/login')}>
              Sign in
            </button>
            <button type="button" onClick={() => go('/signup')}>
              Create an account
            </button>
            <button type="button" onClick={() => go('/admin-login')}>
              Admin sign in
            </button>
            <button type="button" onClick={() => go('/about')}>
              About EcoTrack
            </button>
          </div>
        </div>
        <div className="eco-footer-bottom">
          © {new Date().getFullYear()} EcoTrack. Built for households tracking electricity and water.
        </div>
      </footer>
    </div>
  )
}
