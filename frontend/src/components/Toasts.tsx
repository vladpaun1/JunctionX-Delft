import { useState, useCallback } from 'react'

export type Toast = { id: string; msg: string; kind?: 'danger'|'success'|'info'; ms?: number }

export function useToasts() {
  const [toasts, set] = useState<Toast[]>([])
  const push = useCallback((t: Omit<Toast,'id'>) => {
    const toast: Toast = { id: crypto.randomUUID(), ...t }
    set(prev => [...prev, toast])
    setTimeout(() => set(cur => cur.filter(x => x.id !== toast.id)), t.ms ?? 4000)
  }, [])
  const remove = (id: string) => set(cur => cur.filter(x => x.id !== id))
  return { toasts, push, remove }
}

export default function ToastArea({ toasts, remove }: { toasts: Toast[]; remove: (id: string)=>void }) {
  return (
    <div className="toast-area" style={{ position:'fixed', top: 16, left: '50%', transform:'translateX(-50%)', zIndex: 4000, display:'flex', flexDirection:'column', gap:8 }}>
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.kind ?? 'danger'}`} style={{ pointerEvents:'auto' }}>
          <span>{t.msg}</span>
          <button aria-label="Dismiss" onClick={() => remove(t.id)}>✕</button>
        </div>
      ))}
    </div>
  )
}
