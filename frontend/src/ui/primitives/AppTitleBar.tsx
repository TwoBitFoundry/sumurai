import { cva } from 'class-variance-authority';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Moon, Settings, Sun } from 'lucide-react';
import Image from 'next/image';
import React, { useEffect, useRef, useState } from 'react';
import type { AccountIssue } from '../../types/api';
import { Button } from './Button';
import { cn } from './utils';

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
);

type TabKey = 'dashboard' | 'trends' | 'transactions' | 'accounts' | 'settings';

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'trends', label: 'Trends' },
  { key: 'transactions', label: 'Transactions' },
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
  accountIssues?: AccountIssue[];
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
      accountIssues,
    },
    ref
  ) => {
    const [isIssuesOpen, setIsIssuesOpen] = useState(false);
    const issuesContainerRef = useRef<HTMLDivElement>(null);
    const hasIssues = Boolean(accountIssues && accountIssues.length > 0);
    const issuesCount = accountIssues?.length || 0;

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (
          issuesContainerRef.current &&
          !issuesContainerRef.current.contains(event.target as Node)
        ) {
          setIsIssuesOpen(false);
        }
      };

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          setIsIssuesOpen(false);
        }
      };

      if (isIssuesOpen) {
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
          document.removeEventListener('mousedown', handleClickOutside);
          document.removeEventListener('keydown', handleKeyDown);
        };
      }
    }, [isIssuesOpen]);
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
                  'text-slate-900',
                  'dark:text-white',
                  scrolled ? 'text-xl' : 'text-3xl'
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
                <span style={{ fontFamily: "'Cal Sans', system-ui, sans-serif" }}>Sumurai</span>
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
                <div ref={issuesContainerRef} className="relative inline-flex items-center">
                  <Button
                    type="button"
                    onClick={() => {
                      if (hasIssues) {
                        setIsIssuesOpen((prev) => !prev);
                      } else {
                        onTabChange('settings');
                      }
                    }}
                    variant={currentTab === 'settings' ? 'tabActive' : 'ghost'}
                    size={scrolled ? 'xs' : 'sm'}
                    className={cn(
                      'relative rounded-xl',
                      currentTab !== 'settings'
                        ? 'border border-slate-200 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600'
                        : '',
                      hasIssues &&
                        '!border-amber-400/80 dark:!border-amber-500/80 ring-1 ring-amber-400/40 text-amber-600 dark:text-amber-400'
                    )}
                    aria-label={
                      hasIssues
                        ? `Settings (${issuesCount} account ${issuesCount === 1 ? 'issue' : 'issues'})`
                        : 'Settings'
                    }
                    title={
                      hasIssues
                        ? `${issuesCount} account ${issuesCount === 1 ? 'issue' : 'issues'} need attention`
                        : 'Settings'
                    }
                  >
                    <Settings className={cn('h-4', 'w-4')} />
                    {hasIssues && (
                      <span
                        data-testid="account-issues-badge"
                        className="absolute -top-1 -right-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-slate-800 animate-pulse"
                      >
                        {issuesCount}
                      </span>
                    )}
                  </Button>

                  <AnimatePresence>
                    {hasIssues && isIssuesOpen && (
                      <motion.div
                        data-testid="account-issues-popover"
                        initial={{ opacity: 0, y: -6, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.96 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        className={cn(
                          'absolute right-0 top-full z-50 mt-2 w-80 sm:w-96 rounded-2xl',
                          'border border-slate-200/80 bg-white/95 p-4',
                          'shadow-[0_20px_50px_-20px_rgba(15,23,42,0.35)]',
                          'backdrop-blur-md',
                          'dark:border-slate-700/80 dark:bg-slate-900/95 dark:shadow-[0_20px_50px_-20px_rgba(0,0,0,0.7)]'
                        )}
                        role="dialog"
                        aria-label="Account Issues Summary"
                      >
                        <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 dark:border-slate-700/60">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                              Account Issues
                            </h3>
                          </div>
                          <span className="rounded-full bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                            {issuesCount} {issuesCount === 1 ? 'alert' : 'alerts'}
                          </span>
                        </div>

                        <div className="mt-3 max-h-60 overflow-y-auto space-y-2.5 pr-1">
                          {accountIssues?.map((issue) => (
                            <div
                              key={issue.id}
                              className="rounded-xl border border-slate-200/60 dark:border-slate-700/60 bg-slate-50/70 dark:bg-slate-800/50 p-2.5 text-left"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                                  {issue.institutionName}
                                </span>
                                <span
                                  className={cn(
                                    'shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                                    issue.status === 'needs_reauth'
                                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200'
                                      : 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200'
                                  )}
                                >
                                  {issue.status === 'needs_reauth'
                                    ? 'Re-auth needed'
                                    : 'Sync error'}
                                </span>
                              </div>
                              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                                {issue.errorMessage}
                              </p>
                            </div>
                          ))}
                        </div>

                        <div className="mt-3.5 pt-3 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            size="xs"
                            onClick={() => {
                              setIsIssuesOpen(false);
                              onTabChange('settings');
                            }}
                            className="text-xs"
                          >
                            Open Settings
                          </Button>
                          <Button
                            type="button"
                            variant="primary"
                            size="xs"
                            onClick={() => {
                              setIsIssuesOpen(false);
                              onTabChange('accounts');
                            }}
                            className="text-xs"
                          >
                            Fix in Accounts
                          </Button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
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
