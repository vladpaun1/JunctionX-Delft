const KEY = 'ub:sizes:v1'
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
