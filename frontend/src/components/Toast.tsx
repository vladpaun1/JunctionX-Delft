import { useCallback, useState } from 'react'
import { X } from 'lucide-react'

export type Toast = { id: string; msg: string; kind?: 'danger'|'success'|'info'; ms?: number }

export function useToasts() {
  const [toasts, set] = useState<Toast[]>([])
  const push = useCallback((t: Omit<Toast,'id'>) => {
    const toast: Toast = { id: crypto.randomUUID(), ms: 2500, ...t }
    set(prev => [...prev, toast])
    const ttl = toast.ms ?? 2500
    window.setTimeout(() => set(cur => cur.filter(x => x.id !== toast.id)), ttl)
  }, [])
  const remove = (id: string) => set(cur => cur.filter(x => x.id !== id))
  return { toasts, push, remove }
}

export default function ToastArea({ toasts, remove }: { toasts: Toast[]; remove: (id:string)=>void }) {
  return (
    <div className="toast-wrap">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.kind==='success'?'toast-success':'toast-danger'}`} role="status">
          <span className="text-sm leading-5">{t.msg}</span>
          <button className="btn btn-soft px-2 py-1" onClick={() => remove(t.id)} aria-label="Dismiss">
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  )
}
