import { Leaf } from 'lucide-react'
import { ECOTIPS } from '../ecotips.js'
import { Card } from './ui/Card.jsx'

export function EcoTipCard({ currentEcoTip, onNextTip }) {
  return (
    <Card
      title="Eco Tip"
      icon={Leaf}
      actions={
        <button
          type="button"
          className="eco-btn eco-btn-ghost eco-btn-sm"
          onClick={() => onNextTip(ECOTIPS[Math.floor(Math.random() * ECOTIPS.length)])}
        >
          Next tip
        </button>
      }
    >
      <p className="eco-muted" style={{ margin: 0, lineHeight: 1.6 }}>
        {currentEcoTip}
      </p>
    </Card>
  )
}
