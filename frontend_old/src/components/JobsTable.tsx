// frontend/src/components/JobsTable.tsx
import { useEffect, useMemo, useRef } from 'react'
import type { JobListItem } from '../lib/types'
import { fmtBytes, pretty, copyToClipboard } from '../lib/utils'
import { getJob, getJobData, deleteJob } from '../lib/api'
import { cache } from '../lib/cache'

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

  const rows = useMemo(() => {
    return jobs.map(j => {
      const size = j.src_size ?? cache.getSize(j.id)
      const statusBadge =
        j.status === 'SUCCESS' ? <span className="badge rounded-pill bg-success">SUCCESS</span> :
        j.status === 'FAILED'  ? <span className="badge rounded-pill bg-danger">FAILED</span> :
        j.status === 'RUNNING' ? <span className="badge rounded-pill bg-secondary">RUNNING</span> :
        <span className="badge rounded-pill text-bg-secondary">{j.status ?? 'PENDING'}</span>

      const actions =
        j.status === 'SUCCESS' ? (
          <div className="action-row justify-content-center">
            <button className="btn btn-outline-primary btn-sm" onClick={() => onView(j.id)}>Details</button>
            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={async () => {
                try {
                  const payload = await getJobData(j.id)
                  const ok = await copyToClipboard(pretty(payload))
                  if (!ok) onError('Copy failed')
                } catch (e:any) {
                  onError(e?.message || 'Copy failed')
                }
              }}
            >
              Copy JSON
            </button>
            <a className="btn btn-outline-secondary btn-sm" href={`/api/jobs/${j.id}/export/`} download>Export JSON</a>
            <button className="btn btn-outline-danger btn-sm" onClick={async () => {
              try {
                await deleteJob(j.id)
                onRemove(j.id)
              } catch (e:any) {
                onError(e?.message || 'Delete failed')
              }
            }}>Delete</button>
          </div>
        ) : j.status === 'FAILED' ? (
          <div className="action-row justify-content-center">
            <button className="btn btn-outline-danger btn-sm" disabled>Failed</button>
            <button className="btn btn-outline-secondary btn-sm" onClick={async () => {
              try {
                await deleteJob(j.id)
                onRemove(j.id)
              } catch (e:any) {
                onError(e?.message || 'Delete failed')
              }
            }}>Delete</button>
          </div>
        ) : (
          <div className="action-row justify-content-center">
            <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
          </div>
        )

      return (
        <tr key={j.id}>
          <td className="file-cell text-truncate">{j.filename || ''}</td>
          <td className="size-cell text-end">{fmtBytes(size ?? null)}</td>
          <td className="status-cell text-center">{statusBadge}</td>
          <td className="action-cell text-center">{actions}</td>
        </tr>
      )
    })
  }, [jobs, onView, onError, refreshRow, onRemove])

  return (
    <div className="table-shell">
      <div className="table-responsive table-scroll">
        <table className="table align-middle mb-0" id="jobs-table">
          <colgroup>
            <col className="col-file" />
            <col className="col-size" />
            <col className="col-status" />
            <col className="col-action" />
          </colgroup>
          <thead className="table-head">
            <tr>
              <th className="text-center">File</th>
              <th className="text-center">Size</th>
              <th className="text-center">Status</th>
              <th className="text-center">Action</th>
            </tr>
          </thead>
          <tbody>{rows}</tbody>
        </table>
      </div>
    </div>
  )
}
