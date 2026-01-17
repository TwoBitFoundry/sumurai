import React from 'react'
import { cva } from 'class-variance-authority'
import { Sun, Moon, Settings } from 'lucide-react'
import { Button } from './Button'
import { cn } from './utils'

const titleBarVariants = cva(
  'sticky top-0 z-50 border-b backdrop-blur-sm transition-all duration-200 ease-out',
  {
    variants: {
      state: {
        unauthenticated: 'bg-white/80 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700',
        onboarding: 'bg-white/80 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700',
        authenticated: 'bg-white/80 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700',
      },
      scrolled: {
        true: 'h-14',
        false: 'h-16',
      },
    },
    defaultVariants: {
      state: 'authenticated',
      scrolled: false,
    },
  }
)

type TabKey = 'dashboard' | 'transactions' | 'budgets' | 'accounts' | 'settings'

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'transactions', label: 'Transactions' },
  { key: 'budgets', label: 'Budgets' },
  { key: 'accounts', label: 'Accounts' },
]

export interface AppTitleBarProps {
  state: 'unauthenticated' | 'onboarding' | 'authenticated'
  scrolled: boolean
  themeMode: 'light' | 'dark'
  onThemeToggle: () => void
  onLogout?: () => void
  currentTab?: TabKey
  onTabChange?: (tab: TabKey) => void
  accountFilterNode?: React.ReactNode
}

/**
 * Unified title bar component that adapts to app state.
 *
 * @example
 * ```tsx
 * <AppTitleBar
 *   state="authenticated"
 *   scrolled={scrolled}
 *   themeMode={mode}
 *   onThemeToggle={toggle}
 *   onLogout={handleLogout}
 *   currentTab={currentTab}
 *   onTabChange={handleTabChange}
 *   accountFilterNode={<HeaderAccountFilter scrolled={scrolled} />}
 * />
 * ```
 */
export const AppTitleBar = React.forwardRef<HTMLElement, AppTitleBarProps>(
  (
    {
      state,
      scrolled,
      themeMode,
      onThemeToggle,
      onLogout,
      currentTab,
      onTabChange,
      accountFilterNode,
    },
    ref
  ) => {
    return (
      <header
        ref={ref}
        className={titleBarVariants({
          state,
          scrolled,
        })}
      >
        <div className={cn('px-4', `${scrolled ? 'h-14' : 'h-16'}`, 'transition-all', 'duration-200', 'ease-out')}>
          <div className={cn('flex', 'items-center', 'justify-between', 'h-full')}>
            <div className={cn('flex', 'items-center', 'gap-6')}>
              <div className={cn('flex', 'items-center', 'gap-2', 'font-semibold', 'text-slate-900', 'dark:text-white', scrolled ? 'text-base' : 'text-lg')}>
                Sumurai
              </div>

              {state === 'authenticated' && (
                <nav className={cn('flex', 'gap-2')} aria-label="Primary">
                  {TABS.map(({ key, label }) => (
                    <Button
                      key={key}
                      type="button"
                      onClick={() => onTabChange?.(key)}
                      variant={currentTab === key ? 'tabActive' : 'tab'}
                      className={`${scrolled ? 'px-3 py-1 text-xs' : 'px-4 py-1.5 text-sm'} after:absolute after:inset-[-28%] after:rounded-[999px] after:bg-[radial-gradient(circle_at_35%_30%,rgba(14,165,233,0.16),transparent_62%)] after:opacity-0 after:transition-opacity after:duration-300 hover:after:opacity-90 dark:after:bg-[radial-gradient(circle_at_35%_30%,rgba(56,189,248,0.22),transparent_62%)] ${
                        currentTab !== key
                          ? 'border border-slate-200/70 dark:border-white/10 bg-white/70 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-sky-300/50 dark:hover:border-sky-500/60 hover:shadow-[0_14px_32px_-18px_rgba(56,189,248,0.35)]'
                          : ''
                      }`}
                    >
                      {label}
                    </Button>
                  ))}
                </nav>
              )}
            </div>

            <div className={cn('flex', 'items-center', 'gap-2')}>
              {state === 'authenticated' && accountFilterNode && (
                <>
                  {accountFilterNode}
                  <div className={cn('w-px', 'h-6', 'bg-slate-200', 'dark:bg-slate-600')}></div>
                </>
              )}

              <Button
                type="button"
                onClick={onThemeToggle}
                variant="secondary"
                size={scrolled ? 'xs' : 'sm'}
                className={cn(
                  'rounded-lg',
                  '!bg-amber-500/80',
                  'dark:!bg-purple-600/80',
                  'hover:!bg-amber-600/80',
                  'dark:hover:!bg-purple-700/80',
                  '!border',
                  '!border-amber-400/30',
                  'dark:!border-purple-500/30',
                  '!text-white',
                  'backdrop-blur-sm',
                  'transition-colors'
                )}
                aria-label="Toggle theme"
                title="Toggle theme"
              >
                {themeMode === 'dark' ? (
                  <Moon className={cn('h-4', 'w-4')} />
                ) : (
                  <Sun className={cn('h-4', 'w-4')} />
                )}
              </Button>

              {state === 'authenticated' && onTabChange && (
                <Button
                  type="button"
                  onClick={() => onTabChange('settings')}
                  variant={currentTab === 'settings' ? 'tabActive' : 'ghost'}
                  size={scrolled ? 'xs' : 'sm'}
                  className={cn(
                    'rounded-xl',
                    currentTab !== 'settings' ? 'border border-slate-200 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600' : ''
                  )}
                  aria-label="Settings"
                  title="Settings"
                >
                  <Settings className={cn('h-4', 'w-4')} />
                </Button>
              )}

              {(state === 'onboarding' || state === 'authenticated') && onLogout && (
                <Button
                  type="button"
                  onClick={onLogout}
                  variant="danger"
                  size={scrolled ? 'xs' : 'sm'}
                  title="Logout"
                >
                  Logout
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>
    )
  }
)

AppTitleBar.displayName = 'AppTitleBar'

export default AppTitleBar
