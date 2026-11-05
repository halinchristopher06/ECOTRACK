import { useEffect, useMemo, useRef, useState } from 'react'
import { AppStateContext } from '../hooks/useAppState.js'
import { ECOTIPS } from '../ecotips.js'
import { MUMBAI_ELECTRICITY_TARIFFS, MUMBAI_WATER_TARIFFS } from '../mumbaiTariffs.js'
import { fetchBillingEstimate, fetchApplianceEstimate } from '../services/billingService.js'
import { fetchTariffCatalog } from '../services/tariffService.js'
import { estimateUnitsFromImage } from '../utils/meterVision.js'
import { uid } from '../utils/id.js'
import { useUsageHistory } from '../hooks/useUsageHistory.js'

const DEFAULT_BILLING_ESTIMATE = {
  electricity: {
    units: 0,
    amount: 0,
    averageRate: MUMBAI_ELECTRICITY_TARIFFS[0].slabs[0].rate,
    tariffName: MUMBAI_ELECTRICITY_TARIFFS[0].company,
    unit: MUMBAI_ELECTRICITY_TARIFFS[0].unit,
  },
  water: {
    units: 0,
    amount: 0,
    averageRate: MUMBAI_WATER_TARIFFS[0].slabs[0].rate,
    tariffName: MUMBAI_WATER_TARIFFS[0].company,
    unit: MUMBAI_WATER_TARIFFS[0].unit,
  },
  total: 0,
}

const DEFAULT_APPLIANCE_ESTIMATE = {
  low: 0,
  high: 0,
  rate: MUMBAI_ELECTRICITY_TARIFFS[0].slabs[0].rate,
  tariffName: MUMBAI_ELECTRICITY_TARIFFS[0].company,
}

export function AppStateProvider({ children }) {
  const [adminUsersList, setAdminUsersList] = useState([])
  const [selectedUserRecords, setSelectedUserRecords] = useState(null)

  const [elecUnits, setElecUnits] = useState('')
  const [waterUnits, setWaterUnits] = useState('')
  const [meterVisionOpen, setMeterVisionOpen] = useState(false)
  const [meterVisionType, setMeterVisionType] = useState('electric')
  const [meterVisionPreview, setMeterVisionPreview] = useState('')
  const [meterVisionReading, setMeterVisionReading] = useState(null)
  const [meterVisionBusy, setMeterVisionBusy] = useState(false)
  const fileCamRef = useRef(null)
  const fileGalRef = useRef(null)

  const [currentEcoTip, setCurrentEcoTip] = useState(() => {
    return ECOTIPS[Math.floor(Math.random() * ECOTIPS.length)]
  })

  const [applianceRows, setApplianceRows] = useState(() => [
    { id: uid(), applianceId: 'fan', count: 1, hours: 8 },
  ])
  const [tariffModalOpen, setTariffModalOpen] = useState(false)

  const usageHistoryApi = useUsageHistory()

  const [billingEstimate, setBillingEstimate] = useState(DEFAULT_BILLING_ESTIMATE)
  const [billingBusy, setBillingBusy] = useState(false)
  const [billingError, setBillingError] = useState('')
  const [applianceEstimate, setApplianceEstimate] = useState(DEFAULT_APPLIANCE_ESTIMATE)
  const [tariffCatalog, setTariffCatalog] = useState({
    electricity: MUMBAI_ELECTRICITY_TARIFFS,
    water: MUMBAI_WATER_TARIFFS,
  })

  const electricityTariffs = tariffCatalog.electricity?.length ? tariffCatalog.electricity : MUMBAI_ELECTRICITY_TARIFFS
  const waterTariffs = tariffCatalog.water?.length ? tariffCatalog.water : MUMBAI_WATER_TARIFFS
  const elecEstimate = billingEstimate.electricity?.amount || 0
  const waterEstimate = billingEstimate.water?.amount || 0
  const rate = useMemo(
    () => ({
      electricity:
        billingEstimate.electricity?.averageRate || electricityTariffs[0]?.slabs?.[0]?.rate || 0,
      water: billingEstimate.water?.averageRate || waterTariffs[0]?.slabs?.[0]?.rate || 0,
    }),
    [billingEstimate, electricityTariffs, waterTariffs],
  )

  useEffect(() => {
    let active = true

    const loadTariffs = async () => {
      try {
        const data = await fetchTariffCatalog()
        if (active) setTariffCatalog(data)
      } catch {
        // Fall back to bundled tariffs when the backend is unavailable.
      }
    }

    loadTariffs()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const electric = Number.parseFloat(elecUnits)
    const water = Number.parseFloat(waterUnits)
    const controller = new AbortController()

    // All setState calls below happen inside the debounce timer's callback (not synchronously
    // in the effect body) — including the "inputs cleared" reset — so this is a single
    // asynchronous reaction to the elecUnits/waterUnits inputs changing, not a cascading render.
    const timer = setTimeout(async () => {
      if (!elecUnits && !waterUnits) {
        setBillingEstimate(DEFAULT_BILLING_ESTIMATE)
        setBillingBusy(false)
        setBillingError('')
        return
      }

      setBillingBusy(true)
      setBillingError('')
      try {
        const data = await fetchBillingEstimate(
          {
            electricityUnits: Number.isFinite(electric) ? Math.max(0, electric) : 0,
            waterUnits: Number.isFinite(water) ? Math.max(0, water) : 0,
          },
          controller.signal,
        )
        setBillingEstimate(data)
      } catch (err) {
        if (err.name !== 'AbortError') {
          setBillingError(err.message)
        }
      } finally {
        if (!controller.signal.aborted) setBillingBusy(false)
      }
    }, 250)

    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [elecUnits, waterUnits])

  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const data = await fetchApplianceEstimate(applianceRows, controller.signal)
        setApplianceEstimate(data)
      } catch (err) {
        if (err.name !== 'AbortError') {
          setApplianceEstimate(DEFAULT_APPLIANCE_ESTIMATE)
        }
      }
    }, 250)

    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [applianceRows])

  const maxElecTariffRate = useMemo(
    () => Math.max(...electricityTariffs.flatMap((t) => t.slabs.map((s) => s.rate)), 1),
    [electricityTariffs],
  )
  const maxWaterTariffRate = useMemo(
    () => Math.max(...waterTariffs.flatMap((t) => t.slabs.map((s) => s.rate)), 1),
    [waterTariffs],
  )

  const openMeterVision = (type) => {
    setMeterVisionType(type)
    setMeterVisionPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return ''
    })
    setMeterVisionReading(null)
    setMeterVisionOpen(true)
  }

  const closeMeterVision = () => {
    setMeterVisionOpen(false)
    setMeterVisionPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return ''
    })
    setMeterVisionReading(null)
  }

  const onMeterImage = async (e, type) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setMeterVisionReading(null)
    setMeterVisionBusy(true)
    setMeterVisionPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
    try {
      const reading = await estimateUnitsFromImage(file)
      setMeterVisionReading(reading)
      if (type === 'electric') setElecUnits(String(reading))
      else setWaterUnits(String(reading))
    } finally {
      setMeterVisionBusy(false)
    }
  }

  const addApplianceRow = () => {
    setApplianceRows((rows) => [...rows, { id: uid(), applianceId: 'led9', count: 1, hours: 4 }])
  }

  const removeApplianceRow = (id) => {
    setApplianceRows((rows) => (rows.length <= 1 ? rows : rows.filter((r) => r.id !== id)))
  }

  const value = {
    adminUsersList,
    setAdminUsersList,
    selectedUserRecords,
    setSelectedUserRecords,
    elecUnits,
    setElecUnits,
    waterUnits,
    setWaterUnits,
    meterVisionOpen,
    meterVisionType,
    setMeterVisionType,
    meterVisionPreview,
    meterVisionReading,
    meterVisionBusy,
    fileCamRef,
    fileGalRef,
    openMeterVision,
    closeMeterVision,
    onMeterImage,
    currentEcoTip,
    setCurrentEcoTip,
    applianceRows,
    setApplianceRows,
    addApplianceRow,
    removeApplianceRow,
    tariffModalOpen,
    setTariffModalOpen,
    ...usageHistoryApi,
    billingEstimate,
    billingBusy,
    billingError,
    applianceEstimate,
    tariffCatalog,
    electricityTariffs,
    waterTariffs,
    elecEstimate,
    waterEstimate,
    rate,
    maxElecTariffRate,
    maxWaterTariffRate,
  }

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
}
