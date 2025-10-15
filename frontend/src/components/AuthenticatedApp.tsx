import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Sun, Moon } from 'lucide-react'
import DashboardPage from '../pages/DashboardPage'
import TransactionsPage from '../pages/TransactionsPage'
import BudgetsPage from '../pages/BudgetsPage'
import AccountsPage from '../pages/AccountsPage'
import Card from './ui/Card'
import { ErrorBoundary } from './ErrorBoundary'
import { HeaderAccountFilter } from './HeaderAccountFilter'
import { Button } from '../ui/primitives'
import { useTheme } from '../context/ThemeContext'

type TabKey = 'dashboard' | 'transactions' | 'budgets' | 'accounts'

interface AuthenticatedAppProps {
  onLogout: () => void
}

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'transactions', label: 'Transactions' },
  { key: 'budgets', label: 'Budgets' },
  { key: 'accounts', label: 'Accounts' },
]

export function AuthenticatedApp({ onLogout }: AuthenticatedAppProps) {
  const [tab, setTab] = useState<TabKey>('dashboard')
  const [error, setError] = useState<string | null>(null)
  const [scrolled, setScrolled] = useState(false)
  const { mode, toggle } = useTheme()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 0)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <ErrorBoundary>
      <div className="relative min-h-screen flex flex-col text-slate-900 dark:text-slate-100 transition-colors duration-300 bg-[radial-gradient(128%_96%_at_18%_-20%,#c4e2ff_0%,#dbeafe_30%,#e5f2ff_56%,#ffffff_96%)] dark:bg-[radial-gradient(100%_85%_at_20%_-10%,#0f172a_0%,#0b162c_55%,#05070d_100%)]">
          <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(136%_108%_at_20%_-18%,rgba(14,165,233,0.42)_0%,#e1f2ff_36%,#ffffff_100%)] transition-colors duration-700 dark:bg-[radial-gradient(92%_80%_at_20%_-6%,#0f172a_0%,#0a1224_50%,#05070d_100%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(86%_64%_at_86%_18%,rgba(167,139,250,0.28)_0%,rgba(59,130,246,0.14)_55%,transparent_78%)] transition-opacity duration-700 dark:bg-transparent" />
            <div className="absolute inset-0 bg-[radial-gradient(92%_68%_at_12%_24%,rgba(56,189,248,0.28)_0%,rgba(129,140,248,0.12)_52%,transparent_80%)] transition-opacity duration-700 dark:bg-transparent" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="absolute left-1/2 top-1/2 h-[72rem] w-[72rem] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.28] blur-3xl animate-[rotateAura_95s_linear_infinite] bg-[conic-gradient(from_90deg,#93c5fd,#34d399,#fbbf24,#a78bfa,#fb7185,#93c5fd)] transition-all duration-700 ease-out dark:opacity-[0.4] dark:bg-[conic-gradient(from_110deg,#38bdf8,#34d399,#a78bfa,#fbbf24,#f87171,#38bdf8)]" />
            </div>
            <div className="absolute inset-0 bg-gradient-to-b from-white/70 via-white/38 to-transparent transition-colors duration-700 dark:from-slate-900/68 dark:via-slate-900/42 dark:to-transparent" />
            <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_55%,transparent_60%,rgba(15,23,42,0.1)_100%)] transition-opacity duration-700 dark:bg-[radial-gradient(120%_120%_at_50%_54%,transparent_58%,rgba(2,6,23,0.38)_100%)]" />
          </div>

          <div className="relative z-10 flex min-h-screen flex-col">
            <header className="sticky top-0 z-50 border-b border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
            <div className={`px-4 ${scrolled ? 'h-14' : 'h-16'} transition-all duration-200 ease-out`}>
              <div className="flex items-center justify-between h-full">
                <div className="flex items-center gap-6">
                  <div className={`flex items-center gap-2 font-semibold ${scrolled ? 'text-base' : 'text-lg'}`}>Sumaura</div>

                  <nav className="flex gap-2" aria-label="Primary">
                    {TABS.map(({ key, label }) => (
                      <Button
                        key={key}
                        type="button"
                        onClick={() => setTab(key)}
                        variant={tab === key ? 'tabActive' : 'tab'}
                        className={`${scrolled ? 'px-3 py-1 text-xs' : 'px-4 py-1.5 text-sm'} after:absolute after:inset-[-28%] after:rounded-[999px] after:bg-[radial-gradient(circle_at_35%_30%,rgba(14,165,233,0.16),transparent_62%)] after:opacity-0 after:transition-opacity after:duration-300 hover:after:opacity-90 dark:after:bg-[radial-gradient(circle_at_35%_30%,rgba(56,189,248,0.22),transparent_62%)] ${
                          tab !== key ? 'border border-slate-200/70 dark:border-white/10 bg-white/70 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-sky-300/50 dark:hover:border-sky-500/60 hover:shadow-[0_14px_32px_-18px_rgba(56,189,248,0.35)]' : ''
                        }`}
                      >
                        {label}
                      </Button>
                    ))}
                  </nav>
                </div>

                <div className="flex items-center gap-2">
                  <HeaderAccountFilter scrolled={scrolled} />

                  <div className="w-px h-6 bg-slate-200 dark:bg-slate-600"></div>

                  <Button
                    type="button"
                    onClick={toggle}
                    size={scrolled ? 'xs' : 'sm'}
                    className="rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600"
                    aria-label="Toggle theme"
                    title="Toggle theme"
                  >
                    {mode === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                  </Button>
                  <Button
                    type="button"
                    onClick={onLogout}
                    variant="danger"
                    size={scrolled ? 'xs' : 'sm'}
                    title="Logout"
                  >
                    Logout
                  </Button>
                </div>
              </div>
            </div>
          </header>

            <main className={`relative z-10 flex-1 px-8 sm:px-12 lg:px-16 py-4 sm:py-6 lg:py-8 ${tab === 'dashboard' ? 'pb-28' : ''}`}>
            {error && (
              <Card className="mb-6 border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20">
                <div className="text-sm text-red-600 dark:text-red-400 font-medium">Error</div>
                <div className="text-xs text-red-500 dark:text-red-300 mt-1">{error}</div>
              </Card>
            )}

            <AnimatePresence mode="wait">
              <motion.section
                key={tab}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
              >
                {tab === 'dashboard' && (
                  <div className="space-y-4">
                    <DashboardPage />
                  </div>
                )}

                {tab === 'transactions' && (
                  <div className="space-y-4">
                    <TransactionsPage />
                  </div>
                )}

                {tab === 'budgets' && (
                  <div className="space-y-6">
                    <BudgetsPage />
                  </div>
                )}

                {tab === 'accounts' && (
                  <div className="space-y-6">
                    <AccountsPage onError={setError} />
                  </div>
                )}
              </motion.section>
            </AnimatePresence>
          </main>

            <footer className="relative z-10 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
              <div className="px-4 py-4 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <span className="inline-flex items-center gap-1">💼 Sumaura</span>
              </div>
            </footer>
          </div>
      </div>
    </ErrorBoundary>
  )
}

export default AuthenticatedApp
