import { Modal } from '../ui/Modal.jsx'
import { TariffTable } from '../TariffTable.jsx'

export function TariffModal({ onClose, electricityTariffs, waterTariffs, maxElecTariffRate, maxWaterTariffRate }) {
  return (
    <Modal
      open
      size="lg"
      title="Tariff charts — Mumbai utilities (illustrative)"
      onClose={onClose}
    >
      <TariffTable
        electricityTariffs={electricityTariffs}
        waterTariffs={waterTariffs}
        maxElecTariffRate={maxElecTariffRate}
        maxWaterTariffRate={maxWaterTariffRate}
      />
    </Modal>
  )
}
