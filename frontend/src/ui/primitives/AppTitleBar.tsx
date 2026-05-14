import { cva } from 'class-variance-authority';
import { Settings } from 'lucide-react';
import Image from 'next/image';
import React from 'react';
import {
  border as semanticBorders,
  effect as semanticEffects,
  status as semanticStatus,
  surface as semanticSurfaces,
  text as semanticTextRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';
import { Button } from './Button';
import { cn } from './utils';

export const appTitleBarRecipes = {
  base: ['sticky top-0 z-50 border-b backdrop-blur-md backdrop-saturate-[150%] h-16'],
  shell: [...semanticSurfaces.card, ...semanticBorders.divider, ...semanticEffects.glassShadow],
  logo: {
    container: ['flex', 'items-center', 'gap-2', semanticTextRecipes.primary],
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
  settingsIdle:
    'border border-[var(--color-border-divider)] dark:border-[var(--color-border-divider)] bg-[var(--color-surface-muted-chip)] dark:bg-[var(--color-surface-muted-chip)] hover:bg-[var(--color-surface-hover-row)] dark:hover:bg-[var(--color-surface-hover-row)]',
  pillContainer: [
    'flex items-center gap-1 rounded-full p-1',
    ...semanticSurfaces.mutedChip,
    ...semanticBorders.subtle,
  ],
  pillTab: ['relative flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5'],
} as const;

const titleBarVariants = cva([...appTitleBarRecipes.base], {
  variants: {
    state: {
      unauthenticated: [...appTitleBarRecipes.shell],
      onboarding: [...appTitleBarRecipes.shell],
      authenticated: [...appTitleBarRecipes.shell],
    },
  },
  defaultVariants: {
    state: 'authenticated',
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
  isOnline: boolean;
  onLogout?: () => void;
  currentTab?: TabKey;
  onTabChange?: (tab: TabKey) => void;
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
 *   accountFilterNode={<HeaderAccountFilter />}
 * />
 * ```
 */
export const AppTitleBar = React.forwardRef<HTMLElement, AppTitleBarProps>(
  ({ state, isOnline, onLogout, currentTab, onTabChange }, ref) => {
    return (
      <header
        ref={ref}
        className={titleBarVariants({
          state,
        })}
      >
        <div className={cn('px-4', 'h-full')}>
          <div className={cn('flex', 'items-center', 'justify-between', 'h-full')}>
            <div className={cn('flex', 'items-center', 'gap-6')}>
              <div
                className={cn(
                  ...appTitleBarRecipes.logo.container,
                  appTitleBarRecipes.logo.wordmark
                )}
              >
                <Image
                  src="/sumurai-logo.jpeg"
                  alt="Sumurai Logo"
                  width={32}
                  height={32}
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
                      size="xs"
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
              <div
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1',
                  uiTypographyRecipes.badge,
                  ...(isOnline
                    ? [
                        ...semanticStatus.success.surface,
                        ...semanticStatus.success.border,
                        ...semanticStatus.success.text,
                      ]
                    : [
                        ...semanticStatus.warning.surface,
                        ...semanticStatus.warning.border,
                        ...semanticStatus.warning.text,
                      ])
                )}
                role="status"
                aria-live="polite"
                title={isOnline ? 'Online' : 'Offline'}
              >
                <span
                  className={cn(
                    'h-2 w-2 rounded-full',
                    isOnline
                      ? 'bg-[var(--color-status-success-icon)] dark:bg-[var(--color-status-success-icon)]'
                      : 'bg-[var(--color-status-warning-icon)] dark:bg-[var(--color-status-warning-icon)]'
                  )}
                  aria-hidden="true"
                />
                <span>{isOnline ? 'Online' : 'Offline'}</span>
              </div>

              {state === 'authenticated' && onTabChange && (
                <Button
                  type="button"
                  onClick={() => onTabChange('settings')}
                  variant={currentTab === 'settings' ? 'tabActive' : 'ghost'}
                  size="xs"
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
                <Button type="button" onClick={onLogout} variant="danger" size="xs" title="Logout">
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
