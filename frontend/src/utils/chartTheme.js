/**
 * Recharts draws with SVG attributes, which cannot read CSS custom properties, so chart
 * colours have to be resolved in JavaScript from the live theme instead of from `var(--…)`.
 *
 * Keeping the palette in one place is what makes every chart in the app — dashboard,
 * reports, meter history — look identical in both light and dark mode.
 */
export const CHART_PALETTE = {
  light: {
    electricity: '#059669',
    water: '#0284c7',
    earth: '#b45309',
    grid: '#e2e8f0',
    axis: '#64748b',
    tooltipBg: '#ffffff',
    tooltipBorder: '#e2e8f0',
    tooltipText: '#172033',
  },
  dark: {
    electricity: '#10b981',
    water: '#38bdf8',
    earth: '#fbbf24',
    grid: 'rgba(148, 163, 184, 0.2)',
    axis: '#94a3b8',
    tooltipBg: '#111d30',
    tooltipBorder: '#25344a',
    tooltipText: '#e5eaf2',
  },
}

/** Resolves the palette plus ready-to-spread Recharts tooltip/axis props for a theme name. */
export function chartThemeFor(theme) {
  const palette = CHART_PALETTE[theme] || CHART_PALETTE.light

  return {
    palette,
    tooltipStyle: {
      background: palette.tooltipBg,
      border: `1px solid ${palette.tooltipBorder}`,
      borderRadius: 12,
      fontSize: '0.82rem',
      color: palette.tooltipText,
      boxShadow: 'var(--shadow-md)',
    },
    axisProps: {
      stroke: palette.axis,
      tick: { fill: palette.axis, fontSize: 12 },
      tickLine: false,
      axisLine: { stroke: palette.grid },
    },
  }
}
