import { cva } from 'class-variance-authority';
import { Moon, Settings, Sun } from 'lucide-react';
import Image from 'next/image';
import React from 'react';
import {
  border as semanticBorders,
  surface as semanticSurfaces,
  text as semanticTextRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';
import { Button } from './Button';
import { cn } from './utils';

export const appTitleBarRecipes = {
  base: ['sticky top-0 z-50 border-b backdrop-blur-sm transition-all duration-200 ease-out'],
  shell: [
    ...semanticSurfaces.card,
    ...semanticBorders.divider,
    'dark:bg-[var(--color-surface-solid-panel)]',
  ],
  height: {
    scrolled: 'h-14',
    default: 'h-16',
  },
  logo: {
    container: ['flex', 'items-center', 'gap-2', semanticTextRecipes.primary],
    scrolled: 'text-xl',
    default: 'text-3xl',
    wordmark: uiTypographyRecipes.pageTitle,
    fontFamily: { fontFamily: "'Cal Sans', system-ui, sans-serif" },
  },
  tabIdle: [
    ...semanticBorders.subtle,
    ...semanticSurfaces.card,
    semanticTextRecipes.muted,
    'hover:text-slate-900 dark:hover:text-white',
    'hover:border-[var(--color-border-hover-accent)] dark:hover:border-[var(--color-border-hover-accent)]',
    'hover:shadow-[0_14px_32px_-18px_var(--color-effect-accent-hover)]',
  ].join(' '),
  tabHalo:
    'after:absolute after:inset-[-28%] after:rounded-[999px] after:bg-[radial-gradient(circle_at_35%_30%,rgba(14,165,233,0.16),transparent_62%)] after:opacity-0 after:transition-opacity after:duration-300 hover:after:opacity-90 dark:after:bg-[radial-gradient(circle_at_35%_30%,rgba(56,189,248,0.22),transparent_62%)]',
  divider: 'w-px h-6 bg-[var(--color-border-divider)] dark:bg-[var(--color-border-divider)]',
  themeToggle:
    'rounded-lg !bg-[color:color-mix(in_srgb,var(--color-brand-amber)_80%,transparent)] dark:!bg-[color:color-mix(in_srgb,var(--color-brand-violet)_80%,transparent)] hover:!bg-[color:color-mix(in_srgb,var(--color-brand-amber)_90%,transparent)] dark:hover:!bg-[color:color-mix(in_srgb,var(--color-brand-violet)_90%,transparent)] !border !border-[color:color-mix(in_srgb,var(--color-brand-amber)_30%,transparent)] dark:!border-[color:color-mix(in_srgb,var(--color-brand-violet)_30%,transparent)] !text-white backdrop-blur-sm transition-colors',
  settingsIdle:
    'border border-[var(--color-border-divider)] dark:border-[var(--color-border-divider)] bg-[var(--color-surface-muted-chip)] dark:bg-[var(--color-surface-muted-chip)] hover:bg-[var(--color-surface-hover-row)] dark:hover:bg-[var(--color-surface-hover-row)]',
} as const;

const titleBarVariants = cva([...appTitleBarRecipes.base], {
  variants: {
    state: {
      unauthenticated: [...appTitleBarRecipes.shell],
      onboarding: [...appTitleBarRecipes.shell],
      authenticated: [...appTitleBarRecipes.shell],
    },
    scrolled: {
      true: appTitleBarRecipes.height.scrolled,
      false: appTitleBarRecipes.height.default,
    },
  },
  defaultVariants: {
    state: 'authenticated',
    scrolled: false,
  },
});

type TabKey = 'dashboard' | 'transactions' | 'budgets' | 'accounts' | 'settings';

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'transactions', label: 'Transactions' },
  { key: 'budgets', label: 'Budgets' },
  { key: 'accounts', label: 'Accounts' },
];

export interface AppTitleBarProps {
  state: 'unauthenticated' | 'onboarding' | 'authenticated';
  scrolled: boolean;
  themeMode: 'light' | 'dark';
  onThemeToggle: () => void;
  onLogout?: () => void;
  currentTab?: TabKey;
  onTabChange?: (tab: TabKey) => void;
  accountFilterNode?: React.ReactNode;
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
    const chromeSize = scrolled ? 'xs' : 'titleBarExpanded';

    return (
      <header
        ref={ref}
        className={titleBarVariants({
          state,
          scrolled,
        })}
      >
        <div
          className={cn(
            'px-4',
            `${scrolled ? 'h-14' : 'h-16'}`,
            'transition-all',
            'duration-200',
            'ease-out'
          )}
        >
          <div className={cn('flex', 'items-center', 'justify-between', 'h-full')}>
            <div className={cn('flex', 'items-center', 'gap-6')}>
              <div
                className={cn(
                  ...appTitleBarRecipes.logo.container,
                  scrolled ? appTitleBarRecipes.logo.scrolled : appTitleBarRecipes.logo.default,
                  appTitleBarRecipes.logo.wordmark
                )}
              >
                <Image
                  src="/sumurai-logo.jpeg"
                  alt="Sumurai Logo"
                  width={scrolled ? 32 : 40}
                  height={scrolled ? 32 : 40}
                  className={cn('rounded-md')}
                  unoptimized
                />
                <span className={uiTypographyRecipes.pageTitle}>Sumurai</span>
              </div>

              {state === 'authenticated' && (
                <nav className={cn('flex', 'gap-2')} aria-label="Primary">
                  {TABS.map(({ key, label }) => (
                    <Button
                      key={key}
                      type="button"
                      onClick={() => onTabChange?.(key)}
                      variant={currentTab === key ? 'tabActive' : 'tab'}
                      size={chromeSize}
                      className={cn(
                        appTitleBarRecipes.tabHalo,
                        currentTab !== key ? appTitleBarRecipes.tabIdle : undefined
                      )}
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
                size={chromeSize}
                className={cn(appTitleBarRecipes.themeToggle)}
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
                  size={chromeSize}
                  className={cn(
                    'rounded-xl',
                    currentTab !== 'settings' ? appTitleBarRecipes.settingsIdle : undefined
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
                  size={chromeSize}
                  title="Logout"
                >
                  Logout
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>
    );
  }
);

AppTitleBar.displayName = 'AppTitleBar';

export default AppTitleBar;
