import { useState, useCallback, useRef, useEffect } from 'react'

export type Toast = { id: string; msg: string; kind?: 'danger'|'success'|'info'; ms?: number; exiting?: boolean }

export function useToasts() {
  const [toasts, set] = useState<Toast[]>([])
  const timers = useRef<Record<string, number>>({})

  const scheduleRemoval = (id: string, delay = 180) => {
    window.setTimeout(() => {
      set(cur => cur.filter(t => t.id !== id))
      delete timers.current[id]
    }, delay)
  }

  const push = useCallback((t: Omit<Toast, 'id' | 'exiting'>) => {
    const toast: Toast = { id: crypto.randomUUID(), kind: 'danger', ms: 2500, ...t }
    set(prev => [...prev, toast])
    timers.current[toast.id] = window.setTimeout(() => {
      set(cur => cur.map(x => x.id === toast.id ? { ...x, exiting: true } : x))
      scheduleRemoval(toast.id)
    }, toast.ms)
  }, [])

  const remove = useCallback((id: string) => {
    if (timers.current[id]) { clearTimeout(timers.current[id]); delete timers.current[id] }
    set(cur => cur.map(x => x.id === id ? { ...x, exiting: true } : x))
    scheduleRemoval(id)
  }, [])

  useEffect(() => () => {
    Object.values(timers.current).forEach(clearTimeout)
    timers.current = {}
  }, [])

  return { toasts, push, remove }
}
