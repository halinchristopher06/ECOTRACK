import { Lightbulb } from 'lucide-react'
import { ECOTIPS } from '../../ecotips.js'
import { Modal } from '../ui/Modal.jsx'

export function EcoTipsModal({ onClose }) {
  return (
    <Modal open title="Eco tips — digital electricity meters" onClose={onClose} size="lg">
      <ul className="eco-list">
        {ECOTIPS.map((tip, i) => (
          <li key={i}>
            <div style={{ display: 'flex', gap: 13, alignItems: 'flex-start', minWidth: 0 }}>
              <span className="eco-notice-icon">
                <Lightbulb size={16} aria-hidden="true" />
              </span>
              <span>{tip}</span>
            </div>
          </li>
        ))}
      </ul>
    </Modal>
  )
}
