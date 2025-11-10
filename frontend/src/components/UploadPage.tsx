// frontend/src/components/UploadPage.tsx
import { useCallback, useEffect, useRef, useState } from 'react'
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
  const [modalMeta, setModalMeta] = useState<JobDetail | null>(null)
  const [modalData, setModalData] = useState<JobDataPayload | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const refreshRow = useCallback((id: string, patch: Partial<JobListItem>) => {
    setJobs(cur => cur.map(j => (j.id === id ? { ...j, ...patch } : j)))
  }, [])
  const removeRow = useCallback((id: string) => {
    setJobs(prev => prev.filter(j => j.id !== id))
  }, [])

  useEffect(() => {
    (async () => {
      try {
        const rows = await listJobs(50)
        cache.hydrateJobs(rows)    // <--- restore cached sizes
        setJobs(rows)
      } catch (e: any) {
        push({ msg: e?.message || 'Failed to load jobs', kind: 'danger' })
      }
    })()
  }, [push])

  const handleJobError = useCallback((msg: string) => {
    push({ msg, kind: 'danger', ms: 2500 })
  }, [push])

  const onClear = useCallback(() => {
    setFiles([])
    if (fileInputRef.current) fileInputRef.current.value = ''
    push({ msg: 'Selection cleared.', kind: 'info', ms: 2000 })
  }, [push])

  const onAnalyze = useCallback(async () => {
    if (!files.length) {
      push({ msg: 'Please choose one or more audio/video files.', kind: 'danger', ms: 2500 })
      return
    }
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
    } catch (e: any) {
      push({ msg: e?.message || 'Unexpected error', kind: 'danger' })
    } finally {
      setBusy(false)
    }
  }, [files, push])

  const openModal = useCallback(async (id: string) => {
    try {
      const [meta, data] = await Promise.all([getJob(id).catch(() => null), getJobData(id).catch(() => null)])
      if (!meta) {
        push({ msg: 'Failed to load job details', kind: 'danger' })
        return
      }
      setModalMeta(meta)
      setModalData(data)
    } catch {
      push({ msg: 'Failed to load job details', kind: 'danger' })
    }
  }, [push])

  const onResetSession = useCallback(async () => {
    try {
      await resetSession()
      setJobs([])
      setFiles([])
      if (fileInputRef.current) fileInputRef.current.value = ''
      push({ msg: 'Session reset.', kind: 'info', ms: 2500 })
    } catch (e: any) {
      push({ msg: e?.message || 'Failed to reset session', kind: 'danger' })
    }
  }, [push])

  const copyAllJson = useCallback(async () => {
    try {
      const success = jobs.filter(j => j.status === 'SUCCESS')
      if (!success.length) {
        push({ msg: 'No finished jobs to copy.', kind: 'info', ms: 2500 })
        return
      }
      const payloads = []
      for (const j of success) {
        try { payloads.push(await getJobData(j.id)) } catch { /* skip */ }
      }
      if (!payloads.length) {
        push({ msg: 'No finished jobs to copy.', kind: 'info', ms: 2500 })
        return
      }
      const ok = await copyToClipboard(pretty(payloads))
      push({ msg: ok ? `Copied ${payloads.length} item(s).` : 'Copy failed.', kind: ok ? 'info' : 'danger', ms: 2500 })
    } catch {
      push({ msg: 'Copy failed.', kind: 'danger' })
    }
  }, [jobs, push])

  const exportAllJson = useCallback(async () => {
    try {
      const success = jobs.filter(j => j.status === 'SUCCESS')
      if (!success.length) {
        push({ msg: 'No finished jobs to export.', kind: 'info', ms: 2500 })
        return
      }
      const payloads = []
      for (const j of success) {
        try { payloads.push(await getJobData(j.id)) } catch { /* skip */ }
      }
      if (!payloads.length) {
        push({ msg: 'No finished jobs to export.', kind: 'info', ms: 2500 })
        return
      }
      const fname = `session-transcripts-${isoStamp()}.json`
      downloadBlob(fname, pretty(payloads))
      push({ msg: `Exported ${payloads.length} item(s) as ${fname}.`, kind: 'info', ms: 3000 })
    } catch {
      push({ msg: 'Export failed.', kind: 'danger' })
    }
  }, [jobs, push])

  const actionButton =
    'inline-flex items-center justify-center rounded-2xl border border-slate-300/70 bg-white/80 px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100 dark:hover:bg-slate-800'
  const subtleButton =
    'inline-flex items-center justify-center rounded-2xl border border-transparent px-3 py-2 text-xs font-semibold text-slate-600 transition hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 dark:text-slate-300 dark:hover:text-white'

  return (
    <div className="flex h-full w-full flex-col px-3 pb-8 pt-10 sm:px-6">
      <ToastArea toasts={toasts} remove={remove} />

      <div className="mx-auto flex w-full max-w-5xl flex-1 justify-center">
        <div className="w-full rounded-[28px] border border-white/50 bg-white/85 shadow-page backdrop-blur-sm dark:border-white/10 dark:bg-slate-900/75">
          <div className="flex h-[calc(100dvh-100px)] flex-col overflow-hidden px-4 py-6 sm:px-8 sm:py-8">
            <header className="mb-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Bulk upload</h1>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Choose multiple audio/video files. We’ll process each in the background.
                </p>
              </div>
              <ThemeToggle />
            </header>

            <form className="mb-4 space-y-3" onSubmit={e => e.preventDefault()}>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  ref={fileInputRef}
                  className="block w-full flex-1 rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition file:mr-4 file:rounded-xl file:border-0 file:bg-amber-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-slate-900 focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-200 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100 dark:file:bg-amber-300/30 dark:file:text-amber-100"
                  type="file"
                  id="files"
                  multiple
                  accept="audio/*,video/*"
                  onChange={(e) => setFiles(Array.from(e.target.files || []))}
                />
                <button type="button" className={actionButton} onClick={onClear}>
                  Clear
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={onAnalyze}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-200/70 bg-amber-200/90 px-4 py-2 text-sm font-semibold text-slate-900 shadow-inner transition hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 disabled:cursor-not-allowed disabled:opacity-70 dark:border-amber-200/50 dark:bg-amber-300/30 dark:text-amber-100"
                >
                  <span>{busy ? 'Uploading…' : 'Analyze selected'}</span>
                  {busy && (
                    <span
                      className="h-4 w-4 animate-spin rounded-full border-2 border-amber-900/30 border-t-amber-900 dark:border-amber-200/40 dark:border-t-amber-200"
                      aria-hidden="true"
                    />
                  )}
                </button>

                <button type="button" className={actionButton} onClick={onResetSession}>
                  Reset session
                </button>

                <span className="hidden h-6 w-px bg-slate-200 dark:bg-slate-700 sm:inline-flex" aria-hidden="true" />

                <button type="button" className={subtleButton} onClick={copyAllJson}>
                  Copy all JSON
                </button>
                <button type="button" className={subtleButton} onClick={exportAllJson}>
                  Export all JSON
                </button>
              </div>
            </form>

            <div className="flex flex-1 flex-col overflow-hidden">
              <JobsTable
                jobs={jobs}
                onView={openModal}
                onError={handleJobError}
                refreshRow={refreshRow}
                onRemove={removeRow}
              />
            </div>
          </div>
        </div>
      </div>

      {modalMeta && (
        <JobModal
          meta={modalMeta}
          data={modalData}
          onClose={() => {
            setModalMeta(null)
            setModalData(null)
          }}
        />
      )}
    </div>
  )
}
