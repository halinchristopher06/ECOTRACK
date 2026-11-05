import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Wraps an async function so it cannot be invoked again while a previous
 * invocation from the SAME hook instance is still in flight, and exposes a
 * `loading` flag for driving button disabled/spinner state.
 *
 * The in-flight guard lives inside `run` itself (a ref, checked synchronously)
 * rather than relying solely on the `loading` state value, because a state
 * update is one render behind the actual click in edge cases (fast double
 * click / double-firing trackpads) — belt and suspenders.
 */
export function useAsyncAction(fn) {
  const [loading, setLoading] = useState(false)
  const inFlightRef = useRef(false)
  const fnRef = useRef(fn)
  useEffect(() => {
    fnRef.current = fn
  }, [fn])

  const run = useCallback(
    async (...args) => {
      if (inFlightRef.current) return undefined
      inFlightRef.current = true
      setLoading(true)
      try {
        return await fnRef.current(...args)
      } finally {
        inFlightRef.current = false
        setLoading(false)
      }
    },
    [],
  )

  return { run, loading }
}
