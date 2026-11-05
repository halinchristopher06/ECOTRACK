import { useCallback, useEffect, useState } from 'react'
import { ThemeContext } from '../hooks/useTheme.js'

const STORAGE_KEY = 'ecotrack_theme'

function hasStoredPreference() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'light' || stored === 'dark'
  } catch {
    return false
  }
}

/**
 * Reads the theme that index.html already applied before first paint. Reading it back (rather
 * than re-deriving it) guarantees React's state matches the live DOM exactly, so there is no
 * flash of the wrong theme during hydration.
 */
function getInitialTheme() {
  const applied = document.documentElement.getAttribute('data-theme')
  if (applied === 'light' || applied === 'dark') return applied
  return 'light'
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme)
  // Until the user picks a theme explicitly we keep following the OS setting; once they toggle,
  // their choice is remembered and the OS no longer overrides it.
  const [followSystem, setFollowSystem] = useState(() => !hasStoredPreference())

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    if (followSystem) return
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // ignore persistence failures
    }
  }, [theme, followSystem])

  useEffect(() => {
    if (!followSystem) return undefined
    const query = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!query) return undefined
    const onChange = (event) => setTheme(event.matches ? 'dark' : 'light')
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [followSystem])

  const toggleTheme = useCallback(() => {
    setFollowSystem(false)
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }, [])

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>
}
