export const fmtBytes = (n?: number | null) => {
  const x = Number(n ?? 0)
  if (!isFinite(x) || x <= 0) return '—'
  const u = ['bytes', 'KB', 'MB', 'GB', 'TB']
  let i = 0, v = x
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++ }
  return `${v.toFixed(v < 10 && i > 0 ? 2 : 1)} ${u[i]}`
}

export const mmss = (sec?: number | null) => {
  if (sec == null || !isFinite(sec)) return '—'
  const s = Math.max(0, Math.floor(sec))
  const m = Math.floor(s / 60).toString().padStart(2, '0')
  const t = Math.floor(s % 60).toString().padStart(2, '0')
  return `${m}:${t}`
}

export const pretty = (obj: unknown) => JSON.stringify(obj, null, 2)

export async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const el = document.createElement('textarea')
    el.value = text; document.body.appendChild(el); el.select()
    try { document.execCommand('copy'); return true } catch { return false }
    finally { document.body.removeChild(el) }
  }
}

const KEY = 'ub:sizes:v2'
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} } }
const write = (o: any) => { try { localStorage.setItem(KEY, JSON.stringify(o)) } catch {} }

export const cache = {
  getSize(id: string): number | null {
    const m = read(); const v = m[id]
    return Number.isFinite(v) && v > 0 ? v : null
  },
  setSize(id: string, bytes: number) {
    const n = Number(bytes); if (!Number.isFinite(n) || n <= 0) return
    const m = read(); if (m[id] === n) return; m[id] = n; write(m)
  },
  remove(id: string) { const m = read(); if (id in m) { delete m[id]; write(m) } },
  clear() { localStorage.removeItem(KEY) }
}
