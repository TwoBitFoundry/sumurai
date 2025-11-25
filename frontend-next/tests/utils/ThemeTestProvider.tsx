import { ReactNode } from 'react'
import { ThemeProvider } from '../../src/context/ThemeContext'

interface ThemeTestProviderProps {
  children: ReactNode
}

export function ThemeTestProvider({ children }: ThemeTestProviderProps) {
  return (
    <ThemeProvider>
      {children}
    </ThemeProvider>
  )
}
