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

export const isoStamp = () => {
  const d = new Date(), p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}
