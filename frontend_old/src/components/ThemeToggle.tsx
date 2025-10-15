import { useEffect, useState } from 'react'
const KEY = 'color-mode'

export default function ThemeToggle() {
  const [mode, setMode] = useState<'light'|'dark'>(() => {
    const saved = localStorage.getItem(KEY) as 'light'|'dark'|null
    if (saved) return saved
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-bs-theme', mode)
    localStorage.setItem(KEY, mode)
  }, [mode])

  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => { if (!localStorage.getItem(KEY)) setMode(e.matches ? 'dark' : 'light') }
    mql.addEventListener('change', handler); return () => mql.removeEventListener('change', handler)
  }, [])

  return (
    <button id="theme-toggle" className="btn btn-sm btn-outline-secondary" onClick={() => setMode(prev => prev === 'dark' ? 'light' : 'dark')}>
      <span style={{ display: mode === 'light' ? '' : 'none' }}>🌙</span>
      <span style={{ display: mode === 'dark' ? '' : 'none' }}>☀️</span>
    </button>
  )
}
