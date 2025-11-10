import { useEffect, useMemo, useRef } from 'react'
import type { JobDataPayload, JobDetail } from '../lib/types'
import { mmss } from '../lib/utils'

const legend = [
  { key: 'bad', label: 'Bad language', classes: 'border-amber-400 bg-amber-100/80 text-amber-900 dark:border-amber-200 dark:bg-amber-100/20 dark:text-amber-100' },
  { key: 'hate', label: 'Hate speech', classes: 'border-rose-400 bg-rose-100/70 text-rose-900 dark:border-rose-300 dark:bg-rose-200/10 dark:text-rose-100' },
  { key: 'abuse', label: 'Abuse', classes: 'border-indigo-400 bg-indigo-100/70 text-indigo-900 dark:border-indigo-300 dark:bg-indigo-200/10 dark:text-indigo-100' },
]

const badgeForStatus = (status: string | null | undefined) => {
  const normalized = status ?? 'PENDING'
  if (normalized === 'SUCCESS') {
    return 'inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-400/20 dark:text-emerald-100'
  }
  if (normalized === 'FAILED') {
    return 'inline-flex rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-800 dark:bg-rose-400/20 dark:text-rose-100'
  }
  return 'inline-flex rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-800 dark:bg-slate-700/70 dark:text-slate-100'
}

export default function JobModal({
  meta, data, onClose,
}: { meta: JobDetail | null; data: JobDataPayload | null; onClose: () => void }) {
  const modalRootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [onClose])

  const transcriptHtml = useMemo(() => {
    if (!meta) return ''
    const esc = (s: string) =>
      s.replace(/[<>&"']/g, m => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' } as any)[m])

    const styleFor = (label: string) => {
      const l = (label || '').toLowerCase()
      if (l.includes('abuse')) return 'background:rgba(13,110,253,.18);box-shadow:inset 0 0 0 1px rgba(13,110,253,.35)'
      if (l.includes('hate')) return 'background:rgba(220,53,69,.18);box-shadow:inset 0 0 0 1px rgba(220,53,69,.35)'
      if (l.includes('bad')) return 'background:rgba(255,193,7,.18);box-shadow:inset 0 0 0 1px rgba(255,193,7,.35)'
      return ''
    }

    const flags = data?.flags
    const labels = Array.isArray(meta.labels) ? meta.labels : null
    const txt = data?.transcript_text || meta?.full_text || ''

    const spanHtml = (lbl: string, text: string, start?: number, end?: number) => {
      const isSkip = (lbl || '').toLowerCase().includes('skip')
      const cls = isSkip ? 'plain' : 'flagged'
      const style = isSkip ? '' : styleFor(lbl)
      return `<span class="${cls}" tabindex="0" data-label="${esc(lbl || '')}" data-start="${start ?? ''}" data-end="${end ?? ''}"${style ? ` style="${style}"` : ''}>${esc(text || '')}</span><span> </span>`
    }

    if (flags?.length) {
      return flags.map(f => spanHtml(f.label || '', f.text || '', f.start_sec as any, f.end_sec as any)).join('')
    }
    if (labels?.length) {
      return labels.map((row: any) => {
        if (Array.isArray(row)) return spanHtml(row[0], row[1], row[2], row[3])
        const { label, text, start, end } = row
        return spanHtml(label, text, start, end)
      }).join('')
    }
    return esc(txt || '')
  }, [meta, data])

  useEffect(() => {
    const root = modalRootRef.current
    if (!root) return
    const container = root.querySelector('#transcript-wrap') || root
    const flagged = Array.from(container.querySelectorAll<HTMLSpanElement>('.flagged'))
    if (!flagged.length) return

    let fly = root.querySelector<HTMLDivElement>('.flag-fly')
    if (!fly) {
      fly = document.createElement('div')
      fly.className = 'flag-fly'
      root.appendChild(fly)
    }
    const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))
    const prettyFor = (label: string) => {
      const l = label.toLowerCase()
      if (l.includes('abuse') || l.includes('terror')) return { key: 'abuse', text: 'Abuse' }
      if (l.includes('hate')) return { key: 'hate', text: 'Hate speech' }
      return { key: 'bad', text: 'Bad language' }
    }
    const handlers: Array<() => void> = []
    flagged.forEach((el) => {
      const { key, text } = prettyFor(el.dataset.label || '')
      el.classList.add(key === 'abuse' ? 'lbl-abuse' : key === 'hate' ? 'lbl-hate' : 'lbl-bad')

      const show = () => {
        fly!.textContent = `${text} • ${mmss(Number(el.dataset.start))}–${mmss(Number(el.dataset.end))}`
        fly!.className = `flag-fly ${key}`
        fly!.style.opacity = '1'
      }
      const hide = () => { fly!.style.opacity = '0' }
      const move = (e: MouseEvent) => {
        const margin = 12
        const w = fly!.offsetWidth || 180
        const h = fly!.offsetHeight || 28
        const x = clamp(e.clientX, margin + w / 2, window.innerWidth - margin - w / 2)
        const y = clamp(e.clientY - 14, margin + h, window.innerHeight - margin)
        fly!.style.left = `${x}px`
        fly!.style.top = `${y}px`
      }
      el.addEventListener('mouseenter', show)
      el.addEventListener('mousemove', move)
      el.addEventListener('mouseleave', hide)
      el.addEventListener('focus', show)
      el.addEventListener('blur', hide)
      handlers.push(() => {
        el.removeEventListener('mouseenter', show)
        el.removeEventListener('mousemove', move)
        el.removeEventListener('mouseleave', hide)
        el.removeEventListener('focus', show)
        el.removeEventListener('blur', hide)
      })
    })
    return () => { handlers.forEach(fn => fn()); fly && fly.remove() }
  }, [transcriptHtml])

  useEffect(() => {
    const root = modalRootRef.current
    if (!root) return
    const gutter = root.querySelector<HTMLDivElement>('#transcript-gutter')
    const trans = root.querySelector<HTMLDivElement>('#transcript')
    if (!gutter || !trans) return

    const lineTolerance = 6
    const paint = () => {
      const spans = Array.from(trans.querySelectorAll<HTMLSpanElement>('span.flagged, span.plain'))
      if (!spans.length) { gutter.innerHTML = ''; return }

      const lines: Array<{ top: number; startSec: number }> = []
      spans.forEach((el) => {
        const top = el.offsetTop
        const startSec = Number(el.dataset.start ?? 'NaN')
        const last = lines[lines.length - 1]
        if (!last || Math.abs(last.top - top) > lineTolerance) {
          lines.push({ top, startSec: isFinite(startSec) ? startSec : 0 })
        }
      })

      gutter.style.height = `${trans.scrollHeight}px`

      let html = ''
      for (let i = 0; i < lines.length; i += 5) {
        const y = lines[i].top
        const t = mmss(lines[i].startSec)
        html += `<div class="gut-tick" style="position:absolute; left:0; right:0; top:${y}px;">${t}</div>`
      }
      gutter.innerHTML = html
      const sync = () => { gutter.style.transform = `translateY(${-trans.scrollTop}px)` }
      sync()
    }

    const ro = new ResizeObserver(() => paint())
    ro.observe(trans)
    const onScroll = () => { gutter.style.transform = `translateY(${-trans.scrollTop}px)` }
    trans.addEventListener('scroll', onScroll)
    window.addEventListener('resize', paint)
    const id = requestAnimationFrame(paint)

    return () => {
      cancelAnimationFrame(id)
      ro.disconnect()
      trans.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', paint)
    }
  }, [transcriptHtml])

  if (!meta) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-3 py-10 backdrop-blur-md">
      <div
        ref={modalRootRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        className="flex w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-white/10 bg-white/95 text-slate-900 shadow-2xl dark:border-white/5 dark:bg-slate-950/90 dark:text-slate-100"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200/70 px-6 py-4 dark:border-slate-800/70">
          <div>
            <p className="text-lg font-semibold">Job details</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Inspect the transcript and metadata.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/70 text-lg text-slate-500 transition hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 dark:border-white/10 dark:text-slate-300 dark:hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-hidden">
          <div className="scroll-shell max-h-[70vh] space-y-6 overflow-y-auto px-6 py-6 sm:px-8">
            <dl className="grid grid-cols-1 gap-x-5 gap-y-3 text-sm sm:grid-cols-[160px_minmax(0,1fr)]">
              <dt className="font-semibold text-slate-500 dark:text-slate-400">Status</dt>
              <dd>
                <span className={badgeForStatus(meta.status)}>{meta.status}</span>
              </dd>

              <dt className="font-semibold text-slate-500 dark:text-slate-400">Original file</dt>
              <dd>{meta.original_name || '—'}</dd>

              <dt className="font-semibold text-slate-500 dark:text-slate-400">Stored file</dt>
              <dd>{meta.stored_name || '—'}</dd>

              <dt className="font-semibold text-slate-500 dark:text-slate-400">Uploaded path</dt>
              <dd><code className="text-xs">{meta.upload_rel || '—'}</code></dd>

              <dt className="font-semibold text-slate-500 dark:text-slate-400">Size</dt>
              <dd>{meta.src_size ?? '—'}</dd>

              <dt className="font-semibold text-slate-500 dark:text-slate-400">Duration</dt>
              <dd>{mmss(meta.duration_sec ?? null)}</dd>

              {meta.error ? (
                <>
                  <dt className="font-semibold text-slate-500 dark:text-slate-400">Error</dt>
                  <dd className="text-rose-600 dark:text-rose-300">{meta.error}</dd>
                </>
              ) : null}
            </dl>

            <div className="border-t border-slate-200/70 pt-4 dark:border-slate-800/70">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Transcript</p>
                <div className="flex flex-wrap gap-2 text-xs font-semibold">
                  {legend.map(item => (
                    <span key={item.key} className={`rounded-full border px-3 py-1 ${item.classes}`}>
                      {item.label}
                    </span>
                  ))}
                </div>
              </div>

              <div
                id="transcript-wrap"
                className="relative rounded-2xl border border-slate-200/70 bg-white/70 px-4 py-4 dark:border-slate-800/70 dark:bg-slate-900/70"
              >
                <div
                  id="transcript-gutter"
                  aria-hidden="true"
                  className="pointer-events-none absolute left-4 top-4 bottom-4 w-12 text-right text-[0.65rem] font-bold text-slate-400"
                />
                <div
                  id="transcript"
                  className="scroll-shell max-h-[48vh] overflow-y-auto pl-14 pr-2 text-base leading-8 text-slate-800 dark:text-slate-100"
                  dangerouslySetInnerHTML={{ __html: transcriptHtml }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200/70 px-6 py-4 dark:border-slate-800/70">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center rounded-2xl border border-slate-300/70 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 dark:border-white/20 dark:bg-slate-900/60 dark:text-slate-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
