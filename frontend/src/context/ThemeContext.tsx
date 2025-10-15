import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'

export type ThemeMode = 'light' | 'dark'

export interface ThemeColors {
  chart: {
    primary: string[]
    grid: string
    axis: string
    tooltipBg: string
    tooltipBorder: string
    tooltipText: string
    dotFill: string
  }
  semantic: {
    cash: string
    investments: string
    credit: string
    loan: string
    netWorth: string
  }
}

interface ThemeContextType {
  mode: ThemeMode
  toggle: () => void
  setMode: (mode: ThemeMode) => void
  colors: ThemeColors
}

const lightColors: ThemeColors = {
  chart: {
    primary: [
      '#0ea5e9',
      '#10b981',
      '#f59e0b',
      '#ef4444',
      '#8b5cf6',
      '#059669',
    ],
    grid: '#e2e8f0',
    axis: '#64748b',
    tooltipBg: '#ffffff',
    tooltipBorder: '#e2e8f0',
    tooltipText: '#0f172a',
    dotFill: '#ffffff',
  },
  semantic: {
    cash: '#10b981',
    investments: '#06b6d4',
    credit: '#fb7185',
    loan: '#f59e0b',
    netWorth: '#8b5cf6',
  },
}

const darkColors: ThemeColors = {
  chart: {
    primary: [
      '#38bdf8',
      '#34d399',
      '#fbbf24',
      '#f87171',
      '#a78bfa',
      '#10b981',
    ],
    grid: '#334155',
    axis: '#94a3b8',
    tooltipBg: '#1e293b',
    tooltipBorder: '#475569',
    tooltipText: '#f8fafc',
    dotFill: '#0b1220',
  },
  semantic: {
    cash: '#34d399',
    investments: '#22d3ee',
    credit: '#fb7185',
    loan: '#fbbf24',
    netWorth: '#a78bfa',
  },
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

const getInitialTheme = (): ThemeMode => {
  if (typeof window === 'undefined') return 'dark'

  const stored = localStorage.getItem('theme')
  if (stored === 'light' || stored === 'dark') {
    return stored
  }

  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }

  return 'dark'
}

const applyTheme = (mode: ThemeMode) => {
  if (typeof window === 'undefined') return

  if (mode === 'dark') {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

interface ThemeProviderProps {
  children: ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [mode, setModeState] = useState<ThemeMode>(() => getInitialTheme())

  useEffect(() => {
    applyTheme(mode)
    localStorage.setItem('theme', mode)
  }, [mode])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const handleChange = (e: MediaQueryListEvent) => {
      const stored = localStorage.getItem('theme')
      if (!stored) {
        setModeState(e.matches ? 'dark' : 'light')
      }
    }

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }
  }, [])

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode)
  }, [])

  const toggle = useCallback(() => {
    setModeState(prev => prev === 'dark' ? 'light' : 'dark')
  }, [])

  const colors = mode === 'dark' ? darkColors : lightColors

  return (
    <ThemeContext.Provider value={{ mode, toggle, setMode, colors }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
