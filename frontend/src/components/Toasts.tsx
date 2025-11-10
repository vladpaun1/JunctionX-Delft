import type { Toast } from '../hooks/useToasts'

const palette: Record<NonNullable<Toast['kind']>, string> = {
  danger: 'bg-rose-500 text-white shadow-rose-500/30',
  success: 'bg-emerald-500 text-white shadow-emerald-500/30',
  info: 'bg-sky-500 text-white shadow-sky-500/30',
}

export default function ToastArea({
  toasts, remove,
}: { toasts: Toast[]; remove: (id: string) => void }) {
  return (
    <div
      className="pointer-events-none fixed left-1/2 top-6 z-50 flex w-full max-w-2xl -translate-x-1/2 flex-col gap-3 px-3"
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map(t => {
        const kind = t.kind ?? 'danger'
        return (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-center gap-4 rounded-2xl px-4 py-3 text-base font-semibold shadow-2xl transition duration-200 ${palette[kind]} ${t.exiting ? '-translate-y-2 opacity-0' : 'translate-y-0 opacity-100'}`}
          >
            <span className="flex-1 leading-snug">{t.msg}</span>
            <button
              type="button"
              aria-label="Dismiss"
              className="rounded-full bg-white/20 px-2 py-1 text-sm font-bold backdrop-blur transition hover:bg-white/40"
              onClick={() => remove(t.id)}
            >
              ✕
            </button>
          </div>
        )
      })}
    </div>
  )
}
