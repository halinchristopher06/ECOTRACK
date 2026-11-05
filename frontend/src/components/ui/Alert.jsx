import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'

const VARIANTS = {
  success: { icon: CheckCircle2, className: 'eco-alert-success' },
  error: { icon: AlertCircle, className: 'eco-alert-error' },
  warn: { icon: AlertTriangle, className: 'eco-alert-warn' },
  info: { icon: Info, className: 'eco-alert-info' },
}

/** Inline status message used for validation results, load errors and success confirmations. */
export function Alert({ variant = 'info', children, onClose, className = '' }) {
  if (!children) return null
  const { icon: Icon, className: variantClass } = VARIANTS[variant] || VARIANTS.info

  return (
    <div className={`eco-alert ${variantClass} ${className}`.trim()} role={variant === 'error' ? 'alert' : 'status'}>
      <Icon size={17} className="eco-alert-icon" aria-hidden="true" />
      <div className="eco-alert-body">{children}</div>
      {onClose ? (
        <button type="button" className="eco-alert-close" onClick={onClose} aria-label="Dismiss message">
          <X size={15} />
        </button>
      ) : null}
    </div>
  )
}

/** Floating variant of `Alert` for transient confirmations. */
export function Toast({ variant = 'success', children, onClose }) {
  if (!children) return null

  return (
    <div className="eco-toast-region">
      <div className="eco-toast">
        <Alert variant={variant} onClose={onClose}>
          {children}
        </Alert>
      </div>
    </div>
  )
}
