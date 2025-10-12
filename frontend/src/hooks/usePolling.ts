// src/hooks/usePolling.ts
import { useEffect, useRef } from 'react'

export function usePolling(fn: () => void, delayMs: number | null) {
  const saved = useRef(fn)
  useEffect(() => { saved.current = fn }, [fn])
  useEffect(() => {
    if (delayMs == null) return
    const id = setInterval(() => saved.current(), delayMs)
    return () => clearInterval(id)
  }, [delayMs])
}
