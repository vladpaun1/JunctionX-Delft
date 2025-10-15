// frontend/src/components/UploadPanel.tsx
import React from 'react';

export default function UploadPanel({
  files, setFiles, busy, onAnalyze,
}: {
  files: File[];
  setFiles: React.Dispatch<React.SetStateAction<File[]>>;
  busy: boolean;
  onAnalyze: () => Promise<void>;
}) {
  return (
    <div className="card p-5 mb-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <label className="flex-1">
          <span className="block text-sm mb-2 text-ink-dim">Select audio/video</span>
          <input
            type="file"
            multiple
            accept="audio/*,video/*"
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
            className="block w-full text-sm file:mr-4 file:px-3 file:py-2 file:rounded-lg file:border file:border-white/10 file:bg-white/5 file:text-ink hover:file:bg-white/10"
          />
        </label>
        <div className="flex gap-2">
          <button className="btn btn-primary" onClick={onAnalyze} disabled={busy}>
            {busy ? 'Uploading…' : 'Analyze selected'}
          </button>
        </div>
      </div>
      {files.length > 0 && (
        <p className="text-xs text-ink-dim mt-2">{files.length} file(s) selected.</p>
      )}
    </div>
  );
}
