import { useEffect, useMemo, useRef, useState } from 'react'
import type { JobDataPayload, JobDetail } from '@/lib/types'
import { mmss } from '@/lib/utils'

export default function JobDrawer({
  meta, data, onClose
}: { meta: JobDetail|null; data: JobDataPayload|null; onClose: ()=>void }) {
  const [ticks, setTicks] = useState<number[]>([])
  const bodyRef = useRef<HTMLDivElement|null>(null)
  const tooltipRef = useRef<HTMLDivElement|null>(null)

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onEsc); return () => window.removeEventListener('keydown', onEsc)
  }, [onClose])

  const esc = (s: string) => s.replace(/[<>&"']/g, m => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;','\'':'&#39;'} as any)[m])

  const transcriptHtml = useMemo(() => {
    if (!meta) return ''
    const flags = data?.flags
    const labels = Array.isArray((meta as any).labels) ? (meta as any).labels as any[] : null
    const txt = data?.transcript_text || (meta as any)?.full_text || ''
    const spans: string[] = []

    const pushTick = (sec: number) => {
      const s = Math.floor(sec || 0)
      if (!ticks.includes(s)) setTicks(t => (t.includes(s) ? t : [...t, s]))
    }

    if (flags && flags.length) {
      flags.forEach(f => {
        const isSkip = String(f.label || '').toLowerCase().includes('skip')
        const cls = isSkip ? 'plain' : 'flagged'
        spans.push(`<span class="${cls}" data-label="${esc(f.label || '')}" data-start="${f.start_sec}" data-end="${f.end_sec}">${esc(f.text || '')}</span><span> </span>`)
        pushTick(f.start_sec)
      })
    } else if (labels && labels.length) {
      labels.forEach((row: any) => {
        let lbl, text, start, end
        if (Array.isArray(row)) [lbl, text, start, end] = row
        else ({ label: lbl, text, start, end } = row)
        const isSkip = String(lbl || '').toLowerCase().includes('skip')
        const cls = isSkip ? 'plain' : 'flagged'
        spans.push(`<span class="${cls}" data-label="${esc(lbl || '')}" data-start="${start ?? ''}" data-end="${end ?? ''}">${esc(text || '')}</span><span> </span>`)
        pushTick(Number(start || 0))
      })
    } else {
      spans.push(esc(txt || ''))
    }
    return spans.join('')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta, data])

  useEffect(() => {
    const build = () => {
      if (!meta) return
      const dur = Number(meta.duration_sec ?? 0)
      const t: number[] = []
      for (let s = 0; s <= Math.floor(dur); s += 5) t.push(s)
      setTicks(t)
    }
    build()
  }, [meta])

  useEffect(() => {
    const tw = bodyRef.current
    const tt = tooltipRef.current
    if (!tw || !tt) return

    const onMove = (e: MouseEvent) => {
      const el = (e.target as HTMLElement).closest('.flagged') as HTMLElement | null
      if (el && el.dataset.label) {
        tt.classList.remove('hidden')
        const s = parseFloat(el.dataset.start || '0'), ed = parseFloat(el.dataset.end || '0')
        tt.innerText = `${el.dataset.label} • ${mmss(s)}–${mmss(ed)}`
        tt.style.left = e.clientX + 12 + 'px'
        tt.style.top = e.clientY + 12 + 'px'
        tt.classList.toggle('bad', /bad/i.test(el.dataset.label||''))
        tt.classList.toggle('hate', /hate/i.test(el.dataset.label||''))
        tt.classList.toggle('abuse', /abuse/i.test(el.dataset.label||''))
      } else {
        tt.classList.add('hidden')
      }
    }
    tw.addEventListener('mousemove', onMove)
    tw.addEventListener('mouseleave', () => tt.classList.add('hidden'))
    return () => { tw.removeEventListener('mousemove', onMove) }
  }, [meta, data])

  if (!meta) return null

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute right-0 top-0 bottom-0 w-[min(920px,92vw)] card p-6 overflow-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Job details</h3>
          <button className="btn btn-soft" onClick={onClose}>Close</button>
        </div>

        <dl className="grid grid-cols-2 gap-3 mt-4 text-sm">
          <div><dt className="text-ink-dim">Original</dt><dd>{(meta as any).original_name || '—'}</dd></div>
          <div><dt className="text-ink-dim">Stored</dt><dd>{(meta as any).stored_name || '—'}</dd></div>
          <div><dt className="text-ink-dim">Duration</dt><dd>{mmss(meta.duration_sec ?? null)}</dd></div>
          {(meta as any).error ? (<div className="col-span-2 text-rose-300">{(meta as any).error}</div>) : null}
        </dl>

        <div className="mt-6">
          <div className="text-ink-dim text-sm">Transcript</div>
          <div className="transcript-wrap">
            <div className="gutter">
              {ticks.map((s, i) => i % 5 === 0 ? (
                <div key={s} className="tick">{mmss(s)}</div>
              ) : null)}
            </div>
            <div ref={bodyRef} className="prose prose-invert max-w-none leading-7">
              <div className="transcript" dangerouslySetInnerHTML={{ __html: transcriptHtml }} />
            </div>
            <div ref={tooltipRef} className="flag-fly hidden text-ink"></div>
          </div>
        </div>
      </div>
    </div>
  )
}
