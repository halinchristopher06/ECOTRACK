import { useId, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

/**
 * Form primitives shared by every page.
 *
 * Centralising them is what guarantees the contrast fix actually holds everywhere: every
 * input goes through `.eco-input`, which always sets an explicit text colour and
 * background from the theme tokens, so no field can ever fall back to the browser default
 * (black text on a dark surface). Labels are real `<label>` elements tied to the input id
 * and error/help text is wired up with `aria-describedby`.
 */

function describedBy(id, error, help) {
  if (error) return `${id}-error`
  if (help) return `${id}-help`
  return undefined
}

export function Field({ label, htmlFor, required, help, error, children, className = '' }) {
  return (
    <div className={`eco-field ${className}`.trim()}>
      {label ? (
        <label className="eco-label" htmlFor={htmlFor}>
          {label}
          {required ? (
            <span className="eco-required" aria-hidden="true">
              *
            </span>
          ) : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <p className="eco-error" id={htmlFor ? `${htmlFor}-error` : undefined}>
          {error}
        </p>
      ) : help ? (
        <p className="eco-help" id={htmlFor ? `${htmlFor}-help` : undefined}>
          {help}
        </p>
      ) : null}
    </div>
  )
}

export function TextField({ label, type = 'text', value, onChange, error, help, required = false, icon: Icon, className = '', id, ...rest }) {
  const autoId = useId()
  const inputId = id || autoId
  const [revealed, setRevealed] = useState(false)
  const isPassword = type === 'password'
  const resolvedType = isPassword && revealed ? 'text' : type

  return (
    <div className={`eco-field ${className}`.trim()}>
      {label ? (
        <label className="eco-label" htmlFor={inputId}>
          {label}
          {required ? (
            <span className="eco-required" aria-hidden="true">
              *
            </span>
          ) : null}
        </label>
      ) : null}

      <div className={`eco-input-wrap ${Icon ? 'has-prefix' : ''} ${isPassword ? 'has-suffix' : ''}`.trim()}>
        {Icon ? (
          <span className="eco-input-affix">
            <Icon size={16} aria-hidden="true" />
          </span>
        ) : null}
        <input
          id={inputId}
          type={resolvedType}
          className={`eco-input ${error ? 'is-invalid' : ''}`.trim()}
          value={value}
          onChange={onChange}
          required={required}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy(inputId, error, help)}
          {...rest}
        />
        {isPassword ? (
          <button
            type="button"
            className="eco-input-toggle"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? 'Hide password' : 'Show password'}
            title={revealed ? 'Hide password' : 'Show password'}
            tabIndex={-1}
          >
            {revealed ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="eco-error" id={`${inputId}-error`}>
          {error}
        </p>
      ) : help ? (
        <p className="eco-help" id={`${inputId}-help`}>
          {help}
        </p>
      ) : null}
    </div>
  )
}

export function SelectField({ label, value, onChange, options = [], placeholder, error, help, required = false, className = '', id, ...rest }) {
  const autoId = useId()
  const selectId = id || autoId
  const normalised = options.map((option) =>
    typeof option === 'string' ? { value: option, label: option } : option,
  )

  return (
    <div className={`eco-field ${className}`.trim()}>
      {label ? (
        <label className="eco-label" htmlFor={selectId}>
          {label}
          {required ? (
            <span className="eco-required" aria-hidden="true">
              *
            </span>
          ) : null}
        </label>
      ) : null}

      <select
        id={selectId}
        className={`eco-select ${error ? 'is-invalid' : ''}`.trim()}
        value={value}
        onChange={onChange}
        required={required}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy(selectId, error, help)}
        {...rest}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {normalised.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {error ? (
        <p className="eco-error" id={`${selectId}-error`}>
          {error}
        </p>
      ) : help ? (
        <p className="eco-help" id={`${selectId}-help`}>
          {help}
        </p>
      ) : null}
    </div>
  )
}

export function TextAreaField({ label, value, onChange, error, help, required = false, className = '', id, rows = 4, ...rest }) {
  const autoId = useId()
  const areaId = id || autoId

  return (
    <div className={`eco-field ${className}`.trim()}>
      {label ? (
        <label className="eco-label" htmlFor={areaId}>
          {label}
          {required ? (
            <span className="eco-required" aria-hidden="true">
              *
            </span>
          ) : null}
        </label>
      ) : null}

      <textarea
        id={areaId}
        rows={rows}
        className={`eco-textarea ${error ? 'is-invalid' : ''}`.trim()}
        value={value}
        onChange={onChange}
        required={required}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy(areaId, error, help)}
        {...rest}
      />

      {error ? (
        <p className="eco-error" id={`${areaId}-error`}>
          {error}
        </p>
      ) : help ? (
        <p className="eco-help" id={`${areaId}-help`}>
          {help}
        </p>
      ) : null}
    </div>
  )
}

/**
 * Scores a password 0–4 for the signup form. Deliberately simple and predictable so the
 * feedback is honest about what the rules actually require. Module-private: it is only ever
 * used by `PasswordStrength` below.
 */
function passwordScore(password = '') {
  let score = 0
  if (password.length >= 8) score += 1
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1
  if (/\d/.test(password)) score += 1
  if (/[^A-Za-z0-9]/.test(password)) score += 1
  return score
}

const STRENGTH = [
  { label: 'Too short', color: '#dc2626' },
  { label: 'Weak', color: '#dc2626' },
  { label: 'Fair', color: '#f59e0b' },
  { label: 'Good', color: '#0ea5e9' },
  { label: 'Strong', color: '#047857' },
]

export function PasswordStrength({ password }) {
  if (!password) return null
  const score = passwordScore(password)
  const meta = STRENGTH[score]

  return (
    <div className="eco-strength">
      <div className="eco-strength-track">
        <div
          className="eco-strength-fill"
          style={{ width: `${Math.max(score, 1) * 25}%`, background: meta.color }}
        />
      </div>
      <span className="eco-strength-text" style={{ color: meta.color }}>
        {meta.label}
      </span>
    </div>
  )
}
