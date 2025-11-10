import { useEffect, useState } from 'react'

const STORAGE_KEY = 'color-mode'

const getPreferredScheme = () => window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'

const syncDocumentMode = (mode: 'light' | 'dark') => {
  document.documentElement.classList.toggle('dark', mode === 'dark')
  document.documentElement.dataset.theme = mode
}

export default function ThemeToggle() {
  const [mode, setMode] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as 'light' | 'dark' | null
    return saved ?? getPreferredScheme()
  })

  useEffect(() => {
    syncDocumentMode(mode)
    localStorage.setItem(STORAGE_KEY, mode)
  }, [mode])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (event: MediaQueryListEvent) => {
      if (!localStorage.getItem(STORAGE_KEY)) {
        setMode(event.matches ? 'dark' : 'light')
      }
    }
    media.addEventListener('change', handler)
    return () => media.removeEventListener('change', handler)
  }, [])

  return (
    <button
      type="button"
      id="theme-toggle"
      aria-label="Toggle color theme"
      aria-pressed={mode === 'dark'}
      className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200/70 bg-white/50 text-lg shadow-sm transition hover:border-amber-300 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 dark:border-white/10 dark:bg-slate-800/80 dark:hover:bg-slate-700"
      onClick={() => setMode(prev => (prev === 'dark' ? 'light' : 'dark'))}
    >
      <span role="img" aria-hidden={mode !== 'light'} className={mode === 'light' ? 'block' : 'hidden'}>
        🌙
      </span>
      <span role="img" aria-hidden={mode !== 'dark'} className={mode === 'dark' ? 'block' : 'hidden'}>
        ☀️
      </span>
    </button>
  )
}
