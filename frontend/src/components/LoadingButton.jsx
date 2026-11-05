/**
 * Presentational button that shows a small inline spinner and disables
 * itself while `loading` is true. Accepts the same className/type props as
 * the plain buttons used across the app so it drops in without markup churn.
 */
export function LoadingButton({
  loading = false,
  disabled = false,
  children,
  loadingText,
  className = '',
  type = 'button',
  ...rest
}) {
  return (
    <button
      type={type}
      className={`${className} ${loading ? 'is-loading' : ''}`.trim()}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <span className="btn-spinner-wrap">
          <span className="btn-spinner" aria-hidden="true" />
          {loadingText !== null ? <span>{loadingText || 'Please wait…'}</span> : null}
        </span>
      ) : (
        children
      )}
    </button>
  )
}
