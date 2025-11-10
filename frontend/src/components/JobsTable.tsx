// frontend/src/components/JobsTable.tsx
import { useEffect, useMemo, useRef } from 'react'
import type { JobListItem } from '../lib/types'
import { fmtBytes, pretty, copyToClipboard } from '../lib/utils'
import { getJob, getJobData, deleteJob } from '../lib/api'
import { cache } from '../lib/cache'

const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ')

const badgeClasses: Record<string, string> = {
  SUCCESS: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-400/20 dark:text-emerald-100',
  FAILED: 'bg-rose-100 text-rose-700 dark:bg-rose-400/20 dark:text-rose-100',
  RUNNING: 'bg-slate-200 text-slate-700 dark:bg-slate-700/60 dark:text-slate-100',
  PENDING: 'bg-slate-200 text-slate-700 dark:bg-slate-700/60 dark:text-slate-100',
}

const actionBtnBase =
  'inline-flex items-center justify-center rounded-full border px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300'

const actionVariants: Record<'primary' | 'secondary' | 'danger' | 'pill', string> = {
  primary: 'border-slate-900/40 bg-slate-900/90 text-white hover:bg-slate-900 dark:border-white/10 dark:bg-white/80 dark:text-slate-900',
  secondary: 'border-slate-300/80 bg-white/50 text-slate-700 hover:bg-white dark:border-white/20 dark:bg-slate-800/70 dark:text-slate-100',
  danger: 'border-rose-300/80 bg-rose-100 text-rose-900 hover:bg-rose-200 dark:border-rose-400/40 dark:bg-rose-400/20 dark:text-rose-100',
  pill: 'border-transparent bg-amber-100 text-amber-900 dark:bg-amber-200/30 dark:text-amber-100',
}

export default function JobsTable({
  jobs,
  onView,
  onError,
  refreshRow,
  onRemove,
}: {
  jobs: JobListItem[]
  onView: (id: string) => void
  onError: (msg: string) => void
  refreshRow: (id: string, patch: Partial<JobListItem>) => void
  onRemove: (id: string) => void
}) {
  const polling = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    const start = (id: string) => {
      if (polling.current.has(id)) return
      const iv = window.setInterval(async () => {
        try {
          const data = await getJob(id)
          const size = data.src_size ?? data.wav_size ?? null
          if (size) cache.setSize(id, size)
          if (data.status === 'SUCCESS' || data.status === 'FAILED') {
            refreshRow(id, { status: data.status as any, error: data.error ?? null, src_size: data.src_size ?? null })
            clearInterval(iv); polling.current.delete(id)
            if (data.error) onError(data.error)
          } else {
            refreshRow(id, { status: data.status as any })
          }
        } catch {/* ignore */}
      }, 1200)
      polling.current.set(id, iv)
    }
    jobs.forEach(j => {
      if (j.status !== 'SUCCESS' && j.status !== 'FAILED') start(j.id)
    })
    return () => { polling.current.forEach(clearInterval); polling.current.clear() }
  }, [jobs, onError, refreshRow])

  const rows = useMemo(() => jobs.map(job => {
    const size = job.src_size ?? cache.getSize(job.id)
    const status = job.status ?? 'PENDING'
    const badge = badgeClasses[status] ?? badgeClasses.PENDING

    const successActions = (
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button className={cx(actionBtnBase, actionVariants.primary)} onClick={() => onView(job.id)}>
          Details
        </button>
        <button
          className={cx(actionBtnBase, actionVariants.secondary)}
          onClick={async () => {
            try {
              const payload = await getJobData(job.id)
              const ok = await copyToClipboard(pretty(payload))
              if (!ok) onError('Copy failed')
            } catch (e: any) {
              onError(e?.message || 'Copy failed')
            }
          }}
        >
          Copy JSON
        </button>
        <a
          className={cx(actionBtnBase, actionVariants.secondary)}
          href={`/api/jobs/${job.id}/export/`}
          download
        >
          Export JSON
        </a>
        <button
          className={cx(actionBtnBase, actionVariants.danger)}
          onClick={async () => {
            try {
              await deleteJob(job.id)
              onRemove(job.id)
            } catch (e: any) {
              onError(e?.message || 'Delete failed')
            }
          }}
        >
          Delete
        </button>
      </div>
    )

    const failedActions = (
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button className={cx(actionBtnBase, actionVariants.pill)} disabled>
          Failed
        </button>
        <button
          className={cx(actionBtnBase, actionVariants.secondary)}
          onClick={async () => {
            try {
              await deleteJob(job.id)
              onRemove(job.id)
            } catch (e: any) {
              onError(e?.message || 'Delete failed')
            }
          }}
        >
          Delete
        </button>
      </div>
    )

    const pendingActions = (
      <div className="flex items-center justify-center">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-transparent border-t-slate-600 dark:border-t-slate-100" aria-hidden="true" />
      </div>
    )

    const actionBlock = status === 'SUCCESS' ? successActions : status === 'FAILED' ? failedActions : pendingActions

    return (
      <tr key={job.id} className="border-b border-slate-100/70 last:border-0 dark:border-slate-800/70">
        <td className="px-3 py-3 text-sm font-medium text-slate-800 dark:text-slate-100">
          <span className="block max-w-[420px] truncate">{job.filename || ''}</span>
        </td>
        <td className="px-3 py-3 text-right font-mono text-sm text-slate-600 dark:text-slate-200">{fmtBytes(size ?? null)}</td>
        <td className="px-3 py-3 text-center">
          <span className={cx('inline-flex min-w-[96px] items-center justify-center rounded-full px-3 py-1 text-xs font-bold', badge)}>
            {status}
          </span>
        </td>
        <td className="px-3 py-3">
          {actionBlock}
        </td>
      </tr>
    )
  }), [jobs, onError, onRemove, onView])

  return (
    <div className="flex flex-1 flex-col">
      <div className="scroll-shell h-full overflow-auto rounded-[22px] border border-white/60 bg-white/85 shadow-inner dark:border-slate-800/80 dark:bg-slate-900/70">
        <table className="min-w-full table-fixed text-sm text-slate-700 dark:text-slate-100" id="jobs-table">
          <colgroup>
            <col style={{ width: '44%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '32%' }} />
          </colgroup>
          <thead>
            <tr className="text-xs uppercase tracking-wide text-slate-500">
              {['File', 'Size', 'Status', 'Action'].map(label => (
                <th
                  key={label}
                  className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/95 px-3 py-2 text-center font-semibold backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 dark:text-slate-400"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{rows}</tbody>
        </table>
      </div>
    </div>
  )
}
