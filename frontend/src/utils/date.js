export function ageFromDob(isoDate) {
  if (!isoDate) return ''
  const d = new Date(isoDate + 'T12:00:00')
  if (Number.isNaN(d.getTime())) return ''
  let age = new Date().getFullYear() - d.getFullYear()
  const m = new Date().getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && new Date().getDate() < d.getDate())) age--
  return String(Math.max(0, age))
}

export function ymKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Walk backward from today; collect `count` months, oldest → newest. */
export function collectMonthKeys(count) {
  const keys = []
  const d = new Date()
  d.setDate(1)
  d.setHours(12, 0, 0, 0)
  for (let i = 0; i < count; i++) {
    keys.push(ymKey(d))
    d.setMonth(d.getMonth() - 1)
  }
  return keys.reverse()
}

export function formatMonthLabel(ym) {
  const [y, m] = ym.split('-').map(Number)
  if (!y || !m) return ym
  return new Date(y, m - 1, 1).toLocaleString('en-IN', { month: 'short' })
}

export function seedMonthHistory(n) {
  const keys = collectMonthKeys(n)
  const o = {}
  for (const k of keys) {
    let h = 0
    for (let i = 0; i < k.length; i++) h = (h + k.charCodeAt(i) * (i + 1)) % 500
    o[k] = { electric: 95 + (h % 220), water: 8 + (h % 42) }
  }
  return o
}
