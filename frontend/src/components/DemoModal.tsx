import { useEffect } from 'react'

type DemoModalProps = {
  show: boolean
  onClose: () => void
}

export default function DemoModal({ show, onClose }: DemoModalProps) {
  useEffect(() => {
    if (!show) return
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [show, onClose])

  if (!show) return null

  return (
    <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1055 }}>
      <div className="modal d-block" tabIndex={-1} style={{ zIndex: 1060 }}>
        <div className="modal-dialog modal-dialog-centered modal-lg" style={{ maxWidth: '720px' }}>
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">🚀 Welcome to Trash Panda</h5>
              <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
            </div>
            <div className="modal-body">
              <section className="mb-3">
                <p className="mb-2">
                  <span role="img" aria-label="panda">🦝</span>&nbsp;
                  <strong>Trash Panda</strong> is a hackathon demo built to tackle the challenge of cleaning open speech datasets so extremist rhetoric doesn&rsquo;t seep into inclusive voice-tech.
                </p>
                <p className="mb-0 text-muted small">
                  We convert every upload to a normalized WAV, transcribe it with Whisper, then classify each segment with our custom toxicity model (details in the README).
                </p>
              </section>

              <hr />

              <section className="mb-3">
                <h6 className="fw-semibold mb-2">How to explore <span role="img" aria-label="sparkles">✨</span></h6>
                <ol className="small ps-3 mb-0">
                  <li>Select up to ten short audio/video clips.</li>
                  <li>Hit <strong>Analyze selected</strong> to kick off background processing.</li>
                  <li>Watch the jobs table for conversion, transcription, and labeled spans.</li>
                  <li>Open any job to inspect transcripts, copy/export JSON, or delete it.</li>
                </ol>
              </section>

              <hr />

              <section>
                <h6 className="fw-semibold mb-2">Demo guardrails <span role="img" aria-label="shield">🛡️</span></h6>
                <ul className="mb-0 ps-3 small">
                  <li>Sessions are anonymous and scoped to this browser tab—uploads stay private, but avoid sensitive data.</li>
                  <li>Limit of <strong>10</strong> active uploads per session to keep hackathon infra costs sane.</li>
                  <li>Use the <em>Reset session</em> button to wipe your jobs and reopen this primer.</li>
                  <li>Nightly cleanup purges uploads, normalized audio, and transcripts after ~24h.</li>
                </ul>
              </section>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-primary" onClick={onClose}>Let me try it</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
