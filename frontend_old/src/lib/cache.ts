// frontend/src/lib/cache.ts
const KEY = 'ub:sizes:v2'

function read(): Record<string, number> {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed ? parsed : {}
  } catch {
    return {}
  }
}

function write(obj: Record<string, number>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(obj))
  } catch {
    /* ignore quota or serialization errors */
  }
}

export const cache = {
  getAll(): Record<string, number> {
    return read()
  },

  getSize(id: string): number | null {
    const map = read()
    const val = map[id]
    return Number.isFinite(val) && val > 0 ? val : null
  },

  setSize(id: string, bytes: number): void {
    const n = Number(bytes)
    if (!Number.isFinite(n) || n <= 0) return
    const map = read()
    if (map[id] === n) return
    map[id] = n
    write(map)
  },

  remove(id: string): void {
    const map = read()
    if (id in map) {
      delete map[id]
      write(map)
    }
  },

  clear(): void {
    localStorage.removeItem(KEY)
  },

  /** Apply cached sizes into the loaded jobs array (in-place) */
  hydrateJobs(jobs: any[]): void {
    const map = read()
    jobs.forEach(j => {
      if (!j.src_size && map[j.id]) {
        j.src_size = map[j.id]
      }
    })
  },
}
