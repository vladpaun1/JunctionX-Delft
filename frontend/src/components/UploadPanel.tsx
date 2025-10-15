import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { CloudUpload, Sparkles, RotateCcw } from 'lucide-react'
import { bulkCreate, resetSession } from '@/lib/api'
import type { JobListItem } from '@/lib/types'

export default function UploadPanel({
  onJobs,
  toast
}: {
  onJobs: (created: JobListItem[]) => void
  toast: (msg: string, ok?: boolean)=>void
}) {
  const [busy, setBusy] = useState(false)
  const [files, setFiles] = useState<File[]>([])

  const onDrop = useCallback((accepted: File[]) => {
    setFiles(prev => [...prev, ...accepted])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    accept: {
      'audio/*': ['.mp3','.wav','.m4a','.aac','.ogg'],
      'video/*': ['.mp4','.mov','.mkv','.webm']
    }
  })

  const clearSel = () => setFiles([])

  const analyze = async () => {
    if (!files.length) { toast('Choose one or more files'); return }
    setBusy(true)
    try {
      const created = await bulkCreate(files)
      const rows: JobListItem[] = created.map((j:any) => ({
        id: j.id,
        filename: j.filename || '',
        status: j.error ? 'FAILED' : 'PENDING',
        error: j.error || null,
        src_size: j.size ?? null,
        wav_size: null,
        duration_sec: null,
      }))
      onJobs(rows)
      clearSel()
      toast('Upload accepted. Processing…', true)
    } catch (e:any) {
      toast(e?.message || 'Upload failed')
    } finally {
      setBusy(false)
    }
  }

  const reset = async () => {
    try {
      await resetSession()
      toast('Session reset', true)
      window.location.reload()
    } catch (e:any) {
      toast(e?.message || 'Reset failed')
    }
  }

  return (
    <div className="card p-6 accent-ring">
      <div className="flex items-center justify-between gap-4 mb-4">
        <h2 className="text-lg font-semibold tracking-wide text-ink">Upload & Analyze</h2>
        <button className="btn btn-soft" onClick={reset}><RotateCcw size={18}/> Reset session</button>
      </div>

      <div
        {...getRootProps()}
        className={`rounded-2xl border border-dashed p-10 text-center transition ${
          isDragActive ? 'border-brand/70 bg-white/5' : 'border-white/10 bg-white/5 hover:bg-white/10'
        }`}
        style={{ outline: 'none' }}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-3">
          <CloudUpload className="text-brand" size={38} />
          <p className="text-ink-dim">Drag & drop audio/video files, or click to select.</p>
          <p className="text-xs text-ink-dim/70">MP3, WAV, MP4, MOV, MKV, WEBM</p>
        </div>
      </div>

      {!!files.length && (
        <div className="mt-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-ink-dim">{files.length} file(s) selected</div>
            <div className="flex gap-2">
              <button className="btn btn-soft" onClick={clearSel}>Clear</button>
              <button className="btn btn-primary" onClick={analyze} disabled={busy}>
                <Sparkles size={18}/> {busy ? 'Uploading…' : 'Analyze selected'}
              </button>
            </div>
          </div>
          <ul className="mt-3 grid-auto">
            {files.map((f, i) => (
              <li key={i} className="card px-3 py-2 text-sm flex items-center justify-between">
                <span className="truncate">{f.name}</span>
                <span className="text-ink-dim text-xs">{(f.size/1024/1024).toFixed(2)} MB</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
