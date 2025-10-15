// frontend/src/components/JobsGrid.tsx
import React, { useMemo } from 'react';
import type { JobListItem } from '@/lib/types';
import { fmtBytes } from '@/lib/utils';

type JobsGridProps = {
  jobs: JobListItem[];
  onSelect: (job: JobListItem) => void;
  onDelete: (job: JobListItem) => void;
  onExport: (job: JobListItem) => void;
  onCopyJson?: (job: JobListItem) => void;
};

export default function JobsGrid({ jobs, onSelect, onDelete, onExport, onCopyJson }: JobsGridProps) {
  const cards = useMemo(() => {
    return jobs.map((j) => {
      const size = j.src_size ?? j.wav_size ?? null;
      const badge =
        j.status === 'SUCCESS' ? 'badge-ok' :
        j.status === 'FAILED'  ? 'badge-fail' :
        'badge-run';

      return (
        <button
          key={j.id}
          className="card p-4 text-left hover:shadow-glow transition"
          onClick={() => onSelect(j)}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm text-ink truncate">{j.filename}</div>
              <div className="text-xs text-ink-dim mt-1">
                {fmtBytes(size)} · {j.duration_sec ? `${Math.floor((j.duration_sec || 0) / 60)
                  .toString()
                  .padStart(2, '0')}:${Math.floor((j.duration_sec || 0) % 60)
                  .toString()
                  .padStart(2, '0')}` : '—'}
              </div>
            </div>
            <span className={`badge ${badge}`}>{j.status}</span>
          </div>

          {(j.status === 'SUCCESS' || j.status === 'FAILED') && (
            <div className="mt-3 flex flex-wrap gap-2">
              {onCopyJson && (
                <span
                  onClick={(e) => { e.stopPropagation(); onCopyJson(j); }}
                  className="btn btn-soft text-xs px-3 py-1"
                  role="button"
                >Copy JSON</span>
              )}
              <span
                onClick={(e) => { e.stopPropagation(); onExport(j); }}
                className="btn btn-soft text-xs px-3 py-1"
                role="button"
              >Export</span>
              <span
                onClick={(e) => { e.stopPropagation(); onDelete(j); }}
                className="btn btn-danger text-xs px-3 py-1"
                role="button"
              >Delete</span>
            </div>
          )}
        </button>
      );
    });
  }, [jobs, onSelect, onDelete, onExport, onCopyJson]);

  return <div className="grid-auto">{cards}</div>;
}
