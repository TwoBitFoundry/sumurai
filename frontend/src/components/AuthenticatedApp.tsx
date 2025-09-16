import { useEffect, useState } from 'react'
import DashboardPage from '../pages/DashboardPage'
import TransactionsPage from '../pages/TransactionsPage'
import BudgetsPage from '../pages/BudgetsPage'
import ConnectPage from '../pages/ConnectPage'
import Card from './ui/Card'
import { ErrorBoundary } from './ErrorBoundary'

type TabKey = 'dashboard' | 'transactions' | 'budgets' | 'connect'

interface AuthenticatedAppProps {
  onLogout: () => void
  dark: boolean
  setDark: (next: boolean) => void
}

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'transactions', label: 'Transactions' },
  { key: 'budgets', label: 'Budgets' },
  { key: 'connect', label: 'Connect' },
]

export function AuthenticatedApp({ onLogout, dark, setDark }: AuthenticatedAppProps) {
  const [tab, setTab] = useState<TabKey>('dashboard')
  const [error, setError] = useState<string | null>(null)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 0)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const toggleTheme = () => setDark(!dark)

  return (
    <ErrorBoundary>
      <div className={dark ? 'dark' : ''}>
        <div className="min-h-screen flex flex-col bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-colors duration-300">
          <header className="sticky top-0 z-50 border-b border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
            <div className={`px-4 ${scrolled ? 'h-14' : 'h-16'} flex items-center justify-between transition-all duration-200 ease-out`}>
              <div className={`flex items-center gap-2 font-semibold ${scrolled ? 'text-base' : 'text-lg'}`}>Sumaura</div>
              <nav className={`flex gap-2 ${scrolled ? 'text-xs' : 'text-sm'}`} aria-label="Primary">
                {TABS.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTab(key)}
                    className={`${
                      scrolled ? 'px-2.5 py-1' : 'px-3 py-1.5'
                    } rounded-xl border transition-all duration-200 ${
                      tab === key
                        ? 'bg-primary-100 dark:bg-slate-600 border-primary-300 dark:border-slate-500 text-primary-700 dark:text-slate-100'
                        : 'bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-600'
                    }`}
                  >
                    {label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={toggleTheme}
                  className={`ml-2 ${scrolled ? 'px-2 py-1' : 'px-2 py-1.5'} rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-all duration-200`}
                  aria-label="Toggle theme"
                  title="Toggle theme"
                >
                  {dark ? '🌞' : '🌙'}
                </button>
                <button
                  type="button"
                  onClick={onLogout}
                  className={`ml-2 ${scrolled ? 'px-2.5 py-1' : 'px-3 py-1.5'} rounded-xl border border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all duration-200`}
                  title="Logout"
                >
                  Logout
                </button>
              </nav>
            </div>
          </header>

          <main className={`relative flex-1 px-8 sm:px-12 lg:px-16 py-4 sm:py-6 lg:py-8 ${tab === 'dashboard' ? 'pb-28' : ''}`}>
            {error && (
              <Card className="mb-6 border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20">
                <div className="text-sm text-red-600 dark:text-red-400 font-medium">Error</div>
                <div className="text-xs text-red-500 dark:text-red-300 mt-1">{error}</div>
              </Card>
            )}

            {tab === 'dashboard' && (
              <div className="space-y-4">
                <DashboardPage dark={dark} />
              </div>
            )}

            {tab === 'transactions' && (
              <div className="space-y-4">
                <TransactionsPage />
              </div>
            )}

            <div
              className={tab === 'budgets' ? '' : 'hidden'}
              aria-hidden={tab === 'budgets' ? undefined : true}
              hidden={tab !== 'budgets'}
            >
              <div className="space-y-6">
                <BudgetsPage />
              </div>
            </div>

            {tab === 'connect' && (
              <div className="space-y-6">
                <ConnectPage onError={setError} />
              </div>
            )}
          </main>

          <footer className="relative border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
            <div className="px-4 py-4 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <span className="inline-flex items-center gap-1">💼 Sumaura — Powered by Plaid</span>
            </div>
          </footer>
        </div>
      </div>
    </ErrorBoundary>
  )
}

export default AuthenticatedApp
