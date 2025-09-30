import { Sun, Moon } from 'lucide-react'

interface AppHeaderProps {
  dark: boolean
  onToggleTheme: () => void
  onLogout: () => void
  variant?: 'default' | 'onboarding'
}

export function AppHeader({ dark, onToggleTheme, onLogout, variant = 'default' }: AppHeaderProps) {
  const isOnboarding = variant === 'onboarding'

  const containerClasses = isOnboarding
    ? 'border-b bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-white/30 dark:border-slate-700/30'
    : 'border-b border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm'

  return (
    <header className={`sticky top-0 z-50 ${containerClasses} transition-colors duration-300`}>
      <div className="px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold text-lg text-slate-900 dark:text-slate-100 transition-colors duration-300">Sumaura</div>
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleTheme}
            className="px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-all duration-200 text-slate-700 dark:text-slate-300"
            aria-label="Toggle theme"
            title="Toggle theme"
          >
            {dark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>
          <button
            onClick={onLogout}
            className="px-2.5 py-1 text-xs rounded-xl border border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all duration-200"
            title="Logout"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  )
}