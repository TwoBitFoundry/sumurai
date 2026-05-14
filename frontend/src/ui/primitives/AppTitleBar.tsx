import { cva } from 'class-variance-authority';
import { motion } from 'framer-motion';
import { ArrowLeftRight, Building2, LayoutDashboard, LogOut, Settings, Target } from 'lucide-react';
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
import { Button, buttonRecipes } from './Button';
import { cn } from './utils';

export const appTitleBarRecipes = {
  base: ['sticky top-0 z-50 border-b backdrop-blur-md backdrop-saturate-[150%] h-16'],
  shell: [...semanticSurfaces.card, ...semanticBorders.divider, ...semanticEffects.glassShadow],
  logo: {
    container: ['flex', 'items-center', 'gap-2', semanticTextRecipes.primary],
    wordmark: uiTypographyRecipes.pageTitle,
    fontFamily: { fontFamily: "'Cal Sans', system-ui, sans-serif" },
  },
  settingsIdle:
    'border border-[var(--color-border-divider)] dark:border-[var(--color-border-divider)] bg-[var(--color-surface-muted-chip)] dark:bg-[var(--color-surface-muted-chip)] hover:bg-[var(--color-surface-hover-row)] dark:hover:bg-[var(--color-surface-hover-row)]',
  pillContainer: [
    'flex h-11 items-center gap-1 rounded-full border p-1 backdrop-blur-md backdrop-saturate-[150%]',
    ...semanticSurfaces.glassPanel,
    ...semanticBorders.glass,
    ...semanticEffects.glassShadow,
  ],
  pillTab: ['relative flex h-full items-center justify-center gap-1.5 rounded-full px-3 py-1.5'],
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

const TABS: Array<{
  key: Exclude<TabKey, 'settings'>;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'transactions', label: 'Transactions', icon: ArrowLeftRight },
  { key: 'budgets', label: 'Budgets', icon: Target },
  { key: 'accounts', label: 'Accounts', icon: Building2 },
];

export interface AppTitleBarProps {
  state: 'unauthenticated' | 'onboarding' | 'authenticated';
  scrolled: boolean;
  isOnline: boolean;
  onLogout?: () => void;
  currentTab?: TabKey;
  onTabChange?: (tab: TabKey) => void;
}

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
            <div className={cn('flex', 'flex-1', 'items-center')}>
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
            </div>

            {state === 'authenticated' && (
              <div className={cn('flex', 'flex-1', 'justify-center')}>
                <nav className={cn(...appTitleBarRecipes.pillContainer)} aria-label="Primary">
                  {TABS.map(({ key, label, icon: Icon }) => (
                    <Button
                      key={key}
                      type="button"
                      onClick={() => onTabChange?.(key)}
                      variant={currentTab === key ? 'tabActive' : 'tab'}
                      size="xs"
                      aria-label={label}
                      aria-current={currentTab === key ? 'page' : undefined}
                      className={cn(
                        ...appTitleBarRecipes.pillTab,
                        currentTab === key ? semanticTextRecipes.inverse : semanticTextRecipes.muted
                      )}
                    >
                      {currentTab === key ? (
                        <motion.div
                          layoutId="pill-active"
                          data-slot="active-pill"
                          className={cn('absolute inset-0 rounded-[length:inherit] bg-[inherit]')}
                          transition={{ stiffness: 400, damping: 35 }}
                        />
                      ) : null}
                      <Icon className="relative z-10 h-4 w-4" />
                      {currentTab === key ? <span className="relative z-10">{label}</span> : null}
                    </Button>
                  ))}
                </nav>
              </div>
            )}

            <div className={cn('flex', 'flex-1', 'items-center', 'justify-end', 'gap-2')}>
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
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
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
