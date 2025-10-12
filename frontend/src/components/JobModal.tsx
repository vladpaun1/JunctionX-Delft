import { useEffect, useMemo } from 'react'
import type { JobDataPayload, JobDetail } from '../lib/types'
import { mmss } from '../lib/utils'

export default function JobModal({
  meta, data, onClose,
}: { meta: JobDetail | null; data: JobDataPayload | null; onClose: () => void }) {
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onEsc); return () => window.removeEventListener('keydown', onEsc)
  }, [onClose])

  const esc = (s: string) => s.replace(/[<>&"']/g, m => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'} as any)[m])

  const transcriptHtml = useMemo(() => {
    if (!meta) return ''
    const flags = data?.flags
    const labels = Array.isArray(meta.labels) ? meta.labels : null
    const txt = data?.transcript_text || meta?.full_text || ''
    if (flags && flags.length) {
      return flags.map((f) => {
        const isSkip = String(f.label || '').toLowerCase().includes('skip')
        const cls = isSkip ? 'plain' : 'flagged'
        return `<span class="${cls}" data-label="${esc(f.label || '')}" data-start="${f.start_sec}" data-end="${f.end_sec}">${esc(f.text || '')}</span><span> </span>`
      }).join('')
    } else if (labels && labels.length) {
      return labels.map((row: any) => {
        let lbl, text, start, end
        if (Array.isArray(row)) [lbl, text, start, end] = row
        else ({ label: lbl, text, start, end } = row)
        const isSkip = String(lbl || '').toLowerCase().includes('skip')
        const cls = isSkip ? 'plain' : 'flagged'
        return `<span class="${cls}" data-label="${esc(lbl || '')}" data-start="${start ?? ''}" data-end="${end ?? ''}">${esc(text || '')}</span><span> </span>`
      }).join('')
    } else {
      return esc(txt || '')
    }
  }, [meta, data])

  if (!meta) return null

  return (
    <div className="modal-backdrop" style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.35)', zIndex:1055 }}>
      <div className="modal d-block" tabIndex={-1} style={{ zIndex:1060 }}>
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
              <a className="btn btn-outline-primary" href={`/job/${meta.id}/`} target="_blank" rel="noopener">Open full page</a>
              <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
