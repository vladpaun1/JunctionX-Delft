import type { Toast } from '../hooks/useToasts'

export default function ToastArea({
  toasts, remove,
}: { toasts: Toast[]; remove: (id: string) => void }) {
  return (
    <div className="app-toast-area" aria-live="polite" aria-atomic="true">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`app-toast app-toast-${t.kind ?? 'danger'} ${t.exiting ? 'app-toast-out' : ''}`}
          role="status"
        >
          <span className="app-toast-msg">{t.msg}</span>
          <button className="app-toast-close" aria-label="Dismiss" onClick={() => remove(t.id)}>✕</button>
        </div>
      ))}
    </div>
  )
}
