/**
 * Illustrative Mumbai-region tariff references for dashboard charts (₹/unit style).
 * Slabs are simplified for demo; verify with official DISCOM/BMC notifications for billing.
 */
export const MUMBAI_ELECTRICITY_TARIFFS = [
  {
    company: 'Adani Electricity Mumbai Ltd.',
    consumer: 'Residential (LT)',
    unit: '₹/kWh',
    slabs: [
      { upto: 100, rate: 3.65 },
      { upto: 300, rate: 5.49 },
      { upto: 500, rate: 7.02 },
      { upto: null, rate: 8.52 },
    ],
    note: 'Energy charge slabs indicative; FAC, wheeling, taxes extra.',
  },
  {
    company: 'Tata Power Mumbai Distribution',
    consumer: 'Residential (LT)',
    unit: '₹/kWh',
    slabs: [
      { upto: 100, rate: 3.72 },
      { upto: 300, rate: 5.55 },
      { upto: 500, rate: 7.1 },
      { upto: null, rate: 8.6 },
    ],
    note: 'Slab-wise energy charges; regulatory charges as per MERC orders.',
  },
  {
    company: 'BEST Undertaking',
    consumer: 'Residential (LT)',
    unit: '₹/kWh',
    slabs: [
      { upto: 100, rate: 3.58 },
      { upto: 300, rate: 5.4 },
      { upto: 500, rate: 6.95 },
      { upto: null, rate: 8.45 },
    ],
    note: 'South Mumbai supply; actual bill includes fixed/demand charges.',
  },
  {
    company: 'MSEDCL (Greater Mumbai periphery)',
    consumer: 'Residential (LT)',
    unit: '₹/kWh',
    slabs: [
      { upto: 100, rate: 3.52 },
      { upto: 300, rate: 5.38 },
      { upto: 500, rate: 6.88 },
      { upto: null, rate: 8.35 },
    ],
    note: 'Many Navi Mumbai / Thane areas; confirm category (BPL/Telescopic) on bill.',
  },
]

export const MUMBAI_WATER_TARIFFS = [
  {
    company: 'BMC / MCGM (potable water)',
    consumer: 'Domestic — metered',
    unit: '₹/kl (per 1000 L)',
    slabs: [
      { upto: 500, rate: 5.22 },
      { upto: 960, rate: 11.34 },
      { upto: 1500, rate: 19.44 },
      { upto: null, rate: 36.0 },
    ],
    note: 'Illustrative domestic slab rates; connection size and sewerage may apply separately.',
  },
  {
    company: 'Navi Mumbai Municipal Corp. (NMMC)',
    consumer: 'Residential — metered',
    unit: '₹/kl',
    slabs: [
      { upto: 20, rate: 4.5 },
      { upto: 40, rate: 9.0 },
      { upto: 80, rate: 18.0 },
      { upto: null, rate: 32.0 },
    ],
    note: 'Demo slab structure; check NMMC circular for current year.',
  },
  {
    company: 'TMC / Mira-Bhayander (indicative)',
    consumer: 'Residential',
    unit: '₹/kl',
    slabs: [
      { upto: 15, rate: 5.0 },
      { upto: 40, rate: 12.0 },
      { upto: 80, rate: 22.0 },
      { upto: null, rate: 38.0 },
    ],
    note: 'Representative; Thane region utilities vary by local body.',
  },
]
