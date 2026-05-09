import { cva } from 'class-variance-authority';
import { Moon, Settings, Sun } from 'lucide-react';
import Image from 'next/image';
import React from 'react';
import { designTokens } from '@/ui/tokens';
import { Button } from './Button';
import { cn } from './utils';

const titleBarVariants = cva([...designTokens.components.appTitleBar.base], {
  variants: {
    state: {
      unauthenticated: [...designTokens.components.appTitleBar.shell],
      onboarding: [...designTokens.components.appTitleBar.shell],
      authenticated: [...designTokens.components.appTitleBar.shell],
    },
    scrolled: {
      true: designTokens.components.appTitleBar.height.scrolled,
      false: designTokens.components.appTitleBar.height.default,
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
                  'flex',
                  'items-center',
                  'gap-2',
                  designTokens.text.primary,
                  scrolled
                    ? designTokens.typography.sectionTitle
                    : designTokens.typography.pageTitle
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
                <span style={{ fontFamily: designTokens.typography.brand }}>Sumurai</span>
              </div>

              {state === 'authenticated' && (
                <nav className={cn('flex', 'gap-2')} aria-label="Primary">
                  {TABS.map(({ key, label }) => (
                    <Button
                      key={key}
                      type="button"
                      onClick={() => onTabChange?.(key)}
                      variant={currentTab === key ? 'tabActive' : 'tab'}
                      size={scrolled ? 'xs' : 'sm'}
                      className={`${designTokens.components.appTitleBar.tabHalo} ${
                        currentTab !== key ? designTokens.components.appTitleBar.tabIdle : ''
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
                className={cn(designTokens.components.appTitleBar.themeToggle)}
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
                    currentTab !== 'settings'
                      ? designTokens.components.appTitleBar.settingsIdle
                      : ''
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
    );
  }
);

AppTitleBar.displayName = 'AppTitleBar';

export default AppTitleBar;
