import { useEffect, useMemo, useRef } from 'react'
import type { JobListItem } from '../lib/types'
import { fmtBytes } from '../lib/utils'
import { getJob, deleteJob } from '../lib/api'
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
        } catch {
          /* ignore transient poll errors */
        }
      }, 1200)
      polling.current.set(id, iv)
    }
    jobs.forEach(j => {
      if (j.status !== 'SUCCESS' && j.status !== 'FAILED') start(j.id)
    })
    return () => { polling.current.forEach(clearInterval); polling.current.clear() }
  }, [jobs, onError, refreshRow])


  const handleDelete = async (id: string) => {
    try {
      await deleteJob(id)               // server delete
      onRemove(id)                      // remove from UI
    } catch (e: any) {
      onError(e?.message || 'Delete failed')
    }
  }

  const rows = useMemo(() => {
    return jobs.map(j => {
      const size = j.src_size ?? cache.getSize(j.id)
      const statusBadge =
        j.status === 'SUCCESS' ? <span className="badge bg-success">SUCCESS</span> :
        j.status === 'FAILED'  ? <span className="badge bg-danger">FAILED</span> :
        j.status === 'RUNNING' ? <span className="badge bg-secondary">RUNNING</span> :
        <span className="badge text-bg-secondary">{j.status ?? 'PENDING'}</span>

      const actions =
        j.status === 'SUCCESS' ? (
          <div className="action-row">
            <button className="btn btn-outline-primary btn-sm" onClick={() => onView(j.id)}>Details</button>
            <a className="btn btn-outline-secondary btn-sm" href={`/api/jobs/${j.id}/export/`} download>Export JSON</a>
            <button className="btn btn-outline-danger btn-sm" onClick={() => handleDelete(j.id)}>Delete</button>
          </div>
        ) : j.status === 'FAILED' ? (
          <div className="action-row">
            <button className="btn btn-outline-danger btn-sm" disabled>Failed</button>
            <button className="btn btn-outline-secondary btn-sm" onClick={() => handleDelete(j.id)}>Delete</button>
          </div>
        ) : (
          <div className="action-row"><span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" /></div>
        )

      return (
        <tr key={j.id}>
          <td>{j.filename || ''}</td>
          <td className="size-cell">{fmtBytes(size ?? null)}</td>
          <td className="status">{statusBadge}</td>
          <td className="action-cell">{actions}</td>
        </tr>
      )
    })
  }, [jobs, onView, onError, refreshRow])

  return (
    <div className="table-shell">
      <div className="table-responsive table-scroll">
        <table className="table align-middle mb-0" id="jobs-table">
          <colgroup>
            <col style={{ width: '40%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '38%' }} />
          </colgroup>
          <thead className="table-head">
            <tr>
              <th>File</th>
              <th>Size</th>
              <th>Status</th>
              <th className="text-end">Action</th>
            </tr>
          </thead>
          <tbody>{rows}</tbody>
        </table>
      </div>
    </div>
  )
}
