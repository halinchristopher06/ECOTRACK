import { useEffect } from 'react'
import { X } from 'lucide-react'

/** Accessible dialog: closes on Escape and on backdrop click, and locks page scroll while open. */
export function Modal({ open, title, onClose, children, footer, size = 'md' }) {
  useEffect(() => {
    if (!open) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="eco-modal-backdrop" onClick={onClose} role="presentation">
      <div
        className={`eco-modal ${size === 'lg' ? 'eco-modal-lg' : ''}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="eco-modal-head">
          <h2 className="eco-modal-title">{title}</h2>
          <button type="button" className="eco-icon-btn" onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>
        <div className="eco-modal-body">{children}</div>
        {footer ? <div className="eco-modal-foot">{footer}</div> : null}
      </div>
    </div>
  )
}
