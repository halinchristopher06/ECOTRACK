import { useEffect, useMemo, useState } from 'react'
import { collectMonthKeys, formatMonthLabel, seedMonthHistory } from '../utils/date.js'
import { LS_USAGE_HISTORY, loadJson } from '../utils/storage.js'

export function useUsageHistory() {
  const [oddMonthSpan, setOddMonthSpan] = useState(6)
  const [usageHistory, setUsageHistory] = useState(() => {
    const raw = loadJson(LS_USAGE_HISTORY, null)
    if (raw && typeof raw === 'object' && !Array.isArray(raw) && Object.keys(raw).length > 0) {
      return raw
    }
    return seedMonthHistory(6)
  })
  const [recordMonth, setRecordMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  useEffect(() => {
    localStorage.setItem(LS_USAGE_HISTORY, JSON.stringify(usageHistory))
  }, [usageHistory])

  const usageChartMonths = useMemo(
    () => collectMonthKeys(Math.min(18, Math.max(1, oddMonthSpan))),
    [oddMonthSpan],
  )

  const usageChartPoints = useMemo(() => {
    return usageChartMonths.map((k) => ({
      key: k,
      label: formatMonthLabel(k),
      electric: Number(usageHistory[k]?.electric) || 0,
      water: Number(usageHistory[k]?.water) || 0,
    }))
  }, [usageChartMonths, usageHistory])

  const maxElecBar = useMemo(
    () => Math.max(...usageChartPoints.map((p) => p.electric), 1),
    [usageChartPoints],
  )
  const maxWaterBar = useMemo(
    () => Math.max(...usageChartPoints.map((p) => p.water), 1),
    [usageChartPoints],
  )

  const saveReadingsToHistory = (elecUnits, waterUnits, onSaved) => {
    if (!recordMonth) return
    const ek = Number(elecUnits)
    const wk = Number(waterUnits)
    setUsageHistory((h) => ({
      ...h,
      [recordMonth]: {
        electric: Number.isFinite(ek) ? ek : 0,
        water: Number.isFinite(wk) ? wk : 0,
      },
    }))
    onSaved?.(`Saved readings for ${formatMonthLabel(recordMonth)} (${recordMonth}).`)
  }

  return {
    oddMonthSpan,
    setOddMonthSpan,
    usageHistory,
    recordMonth,
    setRecordMonth,
    usageChartPoints,
    maxElecBar,
    maxWaterBar,
    saveReadingsToHistory,
  }
}
