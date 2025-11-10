// frontend/src/components/UploadPage.tsx
import { useEffect, useState } from 'react'
import ThemeToggle from './ThemeToggle'
import JobsTable from './JobsTable'
import JobModal from './JobModal'
import ToastArea from './Toasts'
import { useToasts } from '../hooks/useToasts'
import type { JobListItem, JobDetail, JobDataPayload } from '../lib/types'
import { listJobs, bulkCreate, getJob, getJobData, resetSession } from '../lib/api'
import { copyToClipboard, pretty, isoStamp, downloadBlob } from '../lib/utils'
import { cache } from '../lib/cache'

export default function UploadPage() {
  const { toasts, push, remove } = useToasts()

  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [jobs, setJobs] = useState<JobListItem[]>([])
  const [modalMeta, setModalMeta] = useState<JobDetail|null>(null)
  const [modalData, setModalData] = useState<JobDataPayload|null>(null)

  const refreshRow = (id: string, patch: Partial<JobListItem>) => {
    setJobs(cur => cur.map(j => j.id === id ? { ...j, ...patch } : j))
  }
  const removeRow = (id: string) => setJobs(prev => prev.filter(j => j.id !== id))

  useEffect(() => {
    (async () => {
      try {
        const rows = await listJobs(50)
        cache.hydrateJobs(rows)    // <--- restore cached sizes
        setJobs(rows)
      } catch (e:any) {
        push({ msg: e?.message || 'Failed to load jobs', kind: 'danger' })
      }
    })()
  }, [push])

  const onClear = () => {
    setFiles([])
    const el = document.getElementById('files') as HTMLInputElement | null
    if (el) el.value = ''
    push({ msg: 'Selection cleared.', kind: 'info', ms: 2000 })
  }

  const onAnalyze = async () => {
    if (!files.length) { push({ msg: 'Please choose one or more audio/video files.', kind: 'danger', ms: 2500 }); return }
    setBusy(true)
    try {
      const created = await bulkCreate(files)
      const updates: JobListItem[] = created.map((j: any) => {
        if (j.size) cache.setSize(j.id, j.size)
        return {
          id: j.id || crypto.randomUUID(),
          filename: j.filename || '',
          status: j.error ? 'FAILED' : 'PENDING',
          error: j.error || null,
          src_size: j.size ?? null,
          wav_size: null,
          duration_sec: null,
        }
      })
      setJobs(cur => [...updates, ...cur])
    } catch (e:any) {
      push({ msg: e?.message || 'Unexpected error', kind: 'danger' })
    } finally {
      setBusy(false)
    }
  }

  const openModal = async (id: string) => {
    try {
      const [meta, data] = await Promise.all([getJob(id).catch(()=>null), getJobData(id).catch(()=>null)])
      if (!meta) { push({ msg: 'Failed to load job details', kind: 'danger' }); return }
      setModalMeta(meta); setModalData(data)
    } catch {
      push({ msg: 'Failed to load job details', kind: 'danger' })
    }
  }

  const onResetSession = async () => {
    try {
      await resetSession()
      setJobs([])
      setFiles([])
      const el = document.getElementById('files') as HTMLInputElement | null
      if (el) el.value = ''
      push({ msg: 'Session reset.', kind: 'info', ms: 2500 })
    } catch (e: any) {
      push({ msg: e?.message || 'Failed to reset session', kind: 'danger' })
    }
  }

  const copyAllJson = async () => {
    try {
      const success = jobs.filter(j => j.status === 'SUCCESS')
      if (!success.length) { push({ msg: 'No finished jobs to copy.', kind: 'info', ms: 2500 }); return }
      const payloads = []
      for (const j of success) {
        try { payloads.push(await getJobData(j.id)) } catch { /* skip */ }
      }
      if (!payloads.length) { push({ msg: 'No finished jobs to copy.', kind: 'info', ms: 2500 }); return }
      const ok = await copyToClipboard(pretty(payloads))
      push({ msg: ok ? `Copied ${payloads.length} item(s).` : 'Copy failed.', kind: ok ? 'info' : 'danger', ms: 2500 })
    } catch {
      push({ msg: 'Copy failed.', kind: 'danger' })
    }
  }

  const exportAllJson = async () => {
    try {
      const success = jobs.filter(j => j.status === 'SUCCESS')
      if (!success.length) { push({ msg: 'No finished jobs to export.', kind: 'info', ms: 2500 }); return }
      const payloads = []
      for (const j of success) {
        try { payloads.push(await getJobData(j.id)) } catch { /* skip */ }
      }
      if (!payloads.length) { push({ msg: 'No finished jobs to export.', kind: 'info', ms: 2500 }); return }
      const fname = `session-transcripts-${isoStamp()}.json`
      downloadBlob(fname, pretty(payloads))
      push({ msg: `Exported ${payloads.length} item(s) as ${fname}.`, kind: 'info', ms: 3000 })
    } catch {
      push({ msg: 'Export failed.', kind: 'danger' })
    }
  }

  return (
    <div className="container-fluid">
      <ToastArea toasts={toasts} remove={remove} />

      <div className="row justify-content-center">
        <div className="col-lg-10">
          <div className="card shadow-sm page-card">
            <div className="card-body d-flex flex-column">
              <header className="mb-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
                <div>
                  <h1 className="h4 mb-1 mb-sm-0">Bulk upload</h1>
                  <p className="text-muted mb-0 small">Choose multiple audio/video files. We’ll process each in the background.</p>
                </div>
                <ThemeToggle />
              </header>

              <form className="mb-3" onSubmit={e => e.preventDefault()}>
                <div className="d-flex gap-2">
                  <input className="form-control" type="file" id="files" multiple accept="audio/*,video/*"
                         onChange={(e) => setFiles(Array.from(e.target.files || []))} />
                  <button className="btn btn-outline-secondary" type="button" onClick={onClear}>Clear</button>
                </div>

                <div className="mt-3 d-flex align-items-center gap-3 flex-wrap">
                  <button className="btn btn-warning" type="button" disabled={busy} onClick={onAnalyze}>
                    <span className="btn-label">{busy ? 'Uploading…' : 'Analyze selected'}</span>
                    {busy && <span className="spinner-border spinner-border-sm ms-2" role="status" aria-hidden="true" />}
                  </button>

                  <button className="btn btn-outline-secondary" type="button" onClick={onResetSession}>Reset session</button>

                  <div className="vr d-none d-sm-block" />

                  <button className="btn btn-sm btn-outline-secondary" type="button" onClick={copyAllJson}>Copy all JSON</button>
                  <button className="btn btn-sm btn-outline-secondary" type="button" onClick={exportAllJson}>Export all JSON</button>
                </div>
              </form>

              <div id="error" className="alert alert-danger d-none" role="alert"></div>

              <JobsTable
                jobs={jobs}
                onView={openModal}
                onError={(m) => push({ msg: m, kind: 'danger', ms: 2500 })}
                refreshRow={refreshRow}
                onRemove={removeRow}
              />

            </div>
          </div>
        </div>
      </div>

      {modalMeta && (
        <JobModal meta={modalMeta} data={modalData} onClose={() => { setModalMeta(null); setModalData(null) }} />
      )}
    </div>
  )
}
