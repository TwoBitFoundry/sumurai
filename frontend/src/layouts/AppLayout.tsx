import { useEffect, useState, type ReactNode } from 'react'
import { Sun, Moon } from 'lucide-react'
import { Button } from '../ui/primitives'
import { useTheme } from '../context/ThemeContext'
import { HeaderAccountFilter } from '../components/HeaderAccountFilter'

type TabKey = 'dashboard' | 'transactions' | 'budgets' | 'accounts'

interface AppLayoutProps {
  children: ReactNode
  currentTab: TabKey
  onTabChange: (tab: TabKey) => void
  onLogout: () => void
  className?: string
}

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'transactions', label: 'Transactions' },
  { key: 'budgets', label: 'Budgets' },
  { key: 'accounts', label: 'Accounts' },
]

export function AppLayout({ children, currentTab, onTabChange, onLogout, className }: AppLayoutProps) {
  const [scrolled, setScrolled] = useState(false)
  const { mode, toggle } = useTheme()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 0)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className={className}>
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
                      onClick={() => onTabChange(key)}
                      variant={currentTab === key ? 'tabActive' : 'tab'}
                      className={`${scrolled ? 'px-3 py-1 text-xs' : 'px-4 py-1.5 text-sm'} after:absolute after:inset-[-28%] after:rounded-[999px] after:bg-[radial-gradient(circle_at_35%_30%,rgba(14,165,233,0.16),transparent_62%)] after:opacity-0 after:transition-opacity after:duration-300 hover:after:opacity-90 dark:after:bg-[radial-gradient(circle_at_35%_30%,rgba(56,189,248,0.22),transparent_62%)] ${
                        currentTab !== key ? 'border border-slate-200/70 dark:border-white/10 bg-white/70 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-sky-300/50 dark:hover:border-sky-500/60 hover:shadow-[0_14px_32px_-18px_rgba(56,189,248,0.35)]' : ''
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

        <main className={`flex-1 px-8 sm:px-12 lg:px-16 py-4 sm:py-6 lg:py-8 ${currentTab === 'dashboard' ? 'pb-28' : ''}`}>
          {children}
        </main>

        <footer className="border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
          <div className="px-4 py-4 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <span className="inline-flex items-center gap-1">💼 Sumaura</span>
          </div>
        </footer>
      </div>
    </div>
  )
}

export default AppLayout
