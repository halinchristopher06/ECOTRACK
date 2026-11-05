import { useNavigate } from 'react-router-dom'
import { Droplets, Receipt, Zap } from 'lucide-react'
import { useAppState } from '../hooks/useAppState.js'
import { TariffTable } from '../components/TariffTable.jsx'
import { PageHeader } from '../components/ui/PageHeader.jsx'
import { Card } from '../components/ui/Card.jsx'
import { Badge } from '../components/ui/Badge.jsx'

export function TariffsPage() {
  const navigate = useNavigate()
  const { electricityTariffs, waterTariffs, maxElecTariffRate, maxWaterTariffRate } = useAppState()

  return (
    <div>
      <PageHeader
        breadcrumbs={[
          { label: 'Overview', onClick: () => navigate('/dashboard') },
          { label: 'Tariffs' },
        ]}
        eyebrow="Tariff reference"
        icon={Receipt}
        title="Tariffs — Mumbai utilities"
        description="Illustrative residential slab tariffs. Units used within the first slab are billed at the lowest rate, and each additional slab is charged at a higher rate — so the more you consume, the higher the rate on the extra units. Confirm final amounts against your own bill or the utility's published schedule."
      />

      <div className="eco-stack">
        <Card
          icon={Zap}
          title="Electricity"
          subtitle="Energy charge slabs per kWh (energy charge only; taxes and other charges are extra)."
          actions={
            <Badge tone="primary" icon={Zap}>
              Residential (LT)
            </Badge>
          }
          padded={false}
        >
          <TariffTable
            electricityTariffs={electricityTariffs}
            waterTariffs={[]}
            maxElecTariffRate={maxElecTariffRate}
            maxWaterTariffRate={maxWaterTariffRate || 1}
          />
        </Card>

        <Card
          icon={Droplets}
          title="Water"
          subtitle="Domestic slab rates per kilolitre (1000 litres)."
          actions={
            <Badge tone="water" icon={Droplets}>
              Domestic — metered
            </Badge>
          }
          padded={false}
        >
          <TariffTable
            electricityTariffs={[]}
            waterTariffs={waterTariffs}
            maxElecTariffRate={maxElecTariffRate || 1}
            maxWaterTariffRate={maxWaterTariffRate}
          />
        </Card>
      </div>
    </div>
  )
}
