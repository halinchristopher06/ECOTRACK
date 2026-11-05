/** Typical wattage bands (W) for monthly cost range estimates */
export const APPLIANCE_CATALOG = [
  { id: 'led9', name: 'LED bulb (9W)', wMin: 7, wMax: 12 },
  { id: 'tube', name: 'LED tube light', wMin: 16, wMax: 22 },
  { id: 'fan', name: 'Ceiling fan', wMin: 50, wMax: 75 },
  { id: 'tv32', name: 'TV (32–43")', wMin: 40, wMax: 90 },
  { id: 'tv55', name: 'TV (55"+)', wMin: 100, wMax: 180 },
  { id: 'fridge', name: 'Refrigerator (frost-free)', wMin: 150, wMax: 250 },
  { id: 'ac1', name: 'AC 1 ton (inverter)', wMin: 900, wMax: 1300 },
  { id: 'ac15', name: 'AC 1.5 ton', wMin: 1400, wMax: 2000 },
  { id: 'wm', name: 'Washing machine', wMin: 300, wMax: 500 },
  { id: 'iron', name: 'Electric iron', wMin: 750, wMax: 1200 },
  { id: 'mixer', name: 'Mixer / grinder', wMin: 500, wMax: 750 },
  { id: 'kettle', name: 'Electric kettle', wMin: 1200, wMax: 1500 },
  { id: 'geyser', name: 'Water geyser (3L instant)', wMin: 3000, wMax: 4500 },
  { id: 'laptop', name: 'Laptop charger', wMin: 45, wMax: 90 },
  { id: 'desktop', name: 'Desktop PC', wMin: 80, wMax: 200 },
  { id: 'router', name: 'Wi‑Fi router', wMin: 5, wMax: 15 },
  { id: 'charger', name: 'Mobile charger', wMin: 5, wMax: 25 },
  { id: 'induction', name: 'Induction cooktop', wMin: 1200, wMax: 2000 },
  { id: 'microwave', name: 'Microwave oven', wMin: 800, wMax: 1200 },
  { id: 'vacuum', name: 'Vacuum cleaner', wMin: 600, wMax: 1400 },
]

export function catalogById(id) {
  return APPLIANCE_CATALOG.find((a) => a.id === id) || APPLIANCE_CATALOG[0]
}
