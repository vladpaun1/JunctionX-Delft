import { useEffect, useMemo, useRef } from 'react'
import type { JobDataPayload, JobDetail } from '../lib/types'
import { mmss } from '../lib/utils'

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
      if (l.includes('hate'))  return 'background:rgba(220,53,69,.18);box-shadow:inset 0 0 0 1px rgba(220,53,69,.35)'
      if (l.includes('bad'))   return 'background:rgba(255,193,7,.18);box-shadow:inset 0 0 0 1px rgba(255,193,7,.35)'
      return '' // unknown/Skip -> no color
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
    } else if (labels?.length) {
      return labels.map((row: any) => {
        if (Array.isArray(row)) return spanHtml(row[0], row[1], row[2], row[3])
        const { label, text, start, end } = row
        return spanHtml(label, text, start, end)
      }).join('')
    }
    return esc(txt || '')
  }, [meta, data])


  // Tooltip + label colorization
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

  // Gutter timestamps (every 5 visual lines)
  useEffect(() => {
    const root = modalRootRef.current
    if (!root) return
    const gutter = root.querySelector<HTMLDivElement>('#transcript-gutter')
    const trans  = root.querySelector<HTMLDivElement>('#transcript')
    if (!gutter || !trans) return

    const lineTolerance = 6 // px difference to still be same line
    const paint = () => {
      // Build line map: [{top, startSec}]
      const spans = Array.from(trans.querySelectorAll<HTMLSpanElement>('span.flagged, span.plain'))
      if (!spans.length) { gutter.innerHTML = ''; return }

      const lines: Array<{ top: number; startSec: number }> = []
      // offsetTop is relative to #transcript (which has position: relative)
      spans.forEach((el) => {
        const top = el.offsetTop
        const startSec = Number(el.dataset.start ?? 'NaN')
        // find or create a line bucket
        const last = lines[lines.length - 1]
        if (!last || Math.abs(last.top - top) > lineTolerance) {
          lines.push({ top, startSec: isFinite(startSec) ? startSec : 0 })
        }
      })

      // Size the gutter to match transcript scroll height
      gutter.style.height = `${trans.scrollHeight}px`

      // render ticks every 5th line
      let html = ''
      for (let i = 0; i < lines.length; i += 5) {
        const y = lines[i].top
        const t = mmss(lines[i].startSec)
        html += `<div class="gut-tick" style="position:absolute; left:0; right:0; top:${y}px;">${t}</div>`
      }
      gutter.innerHTML = html
      // align ticks when scrolling (if gutter is not inside the scroller)
      const sync = () => { gutter.style.transform = `translateY(${-trans.scrollTop}px)` }
      sync()
    }

    // initial + on resize/scroll/content changes
    const ro = new ResizeObserver(() => paint())
    ro.observe(trans)
    const onScroll = () => { gutter.style.transform = `translateY(${-trans.scrollTop}px)` }
    trans.addEventListener('scroll', onScroll)
    window.addEventListener('resize', paint)

    // paint after layout
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
    <div className="modal-backdrop" style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.35)', zIndex:1055 }}>
      <div className="modal d-block" tabIndex={-1} style={{ zIndex:1060 }} ref={modalRootRef}>
        <div className="modal-dialog modal-xl modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Job details</h5>
              <button type="button" className="btn-close" onClick={onClose}/>
            </div>
            <div className="modal-body">
              <dl className="row">
                <dt className="col-sm-3">Status</dt>
                <dd className="col-sm-9">
                  {meta.status === 'SUCCESS' ? <span className="badge bg-success">SUCCESS</span> :
                   meta.status === 'FAILED'  ? <span className="badge bg-danger">FAILED</span> :
                   meta.status === 'RUNNING' ? <span className="badge bg-secondary">RUNNING</span> :
                   <span className="badge text-bg-secondary">{meta.status}</span>}
                </dd>
                <dt className="col-sm-3">Original file</dt><dd className="col-sm-9">{meta.original_name || '—'}</dd>
                <dt className="col-sm-3">Stored file</dt><dd className="col-sm-9">{meta.stored_name || '—'}</dd>
                <dt className="col-sm-3">Uploaded path</dt><dd className="col-sm-9"><code>{meta.upload_rel || '—'}</code></dd>
                <dt className="col-sm-3">Size</dt><dd className="col-sm-9">{meta.src_size ?? '—'}</dd>
                <dt className="col-sm-3">Duration</dt><dd className="col-sm-9">{mmss(meta.duration_sec ?? null)}</dd>
                {meta.error ? (<><dt className="col-sm-3">Error</dt><dd className="col-sm-9 text-danger">{meta.error}</dd></>) : null}
              </dl>

              <hr />
              <div className="d-flex align-items-center justify-content-between mb-2">
                <h6 className="mb-0">Transcript</h6>
                <div className="legend">
                  <span className="chip bad">Bad language</span>
                  <span className="chip hate">Hate speech</span>
                  <span className="chip abuse">Abuse</span>
                </div>
              </div>

              <div className="transcript-wrap" id="transcript-wrap">
                <div className="gutter" id="transcript-gutter" aria-hidden="true"></div>
                <div className="transcript" id="transcript" dangerouslySetInnerHTML={{ __html: transcriptHtml }} />
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
