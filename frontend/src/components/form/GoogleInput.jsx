import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

export function GoogleInput({ label, type = "text", value, onChange, onBlur, placeholder = " ", required = false, autoComplete, name }) {
  const [revealed, setRevealed] = useState(false)
  const isPassword = type === 'password'
  const resolvedType = isPassword && revealed ? 'text' : type

  return (
    <div className="google-input-group">
      <div className="google-input-wrap">
        <input
          type={resolvedType}
          className="google-input"
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
          required={required}
          autoComplete={autoComplete}
          name={name}
          style={isPassword ? { paddingRight: '40px' } : undefined}
        />
        <label className="google-label">{label}</label>
        {isPassword && (
          <button
            type="button"
            className="google-password-toggle"
            aria-label={revealed ? 'Hide password' : 'Show password'}
            onClick={() => setRevealed((v) => !v)}
            tabIndex={-1}
          >
            {revealed ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
    </div>
  )
}
