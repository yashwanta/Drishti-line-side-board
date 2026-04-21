import { useEffect, useRef } from 'react'

/**
 * Calls `fn` immediately and then every `intervalMs` milliseconds.
 * Cleans up the interval on unmount.
 *
 * @param {() => void} fn          — async-safe fetch function
 * @param {number}     intervalMs  — default 15 000 ms
 * @param {boolean}    enabled     — pause polling when false (e.g. modal open)
 */
export function useAutoRefresh(fn, intervalMs = 15_000, enabled = true) {
  const savedFn = useRef(fn)

  // Keep ref current so the interval always calls the latest version
  useEffect(() => { savedFn.current = fn }, [fn])

  useEffect(() => {
    if (!enabled) return

    // Run immediately
    savedFn.current()

    const id = setInterval(() => savedFn.current(), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs, enabled])
}
