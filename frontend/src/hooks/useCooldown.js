import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Drives a visible countdown (in seconds) used to throttle rapid sequential
 * re-clicks of OTP-sending buttons (Resend OTP, Send OTP, Send reset code).
 * Call `start()` after a successful send; `seconds` ticks down to 0 once per
 * second and the interval is cleared on unmount.
 */
export function useCooldown(duration = 30) {
  const [seconds, setSeconds] = useState(0)
  const intervalRef = useRef(null)

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  const start = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setSeconds(duration)
    intervalRef.current = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
          return 0
        }
        return s - 1
      })
    }, 1000)
  }, [duration])

  return { seconds, active: seconds > 0, start }
}
