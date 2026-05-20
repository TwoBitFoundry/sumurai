import { cva } from 'class-variance-authority';
import { motion } from 'framer-motion';
import {
  ArrowLeftRight,
  Building2,
  LayoutDashboard,
  LogOut,
  Settings,
  Target,
  Wifi,
  WifiOff,
} from 'lucide-react';
import Image from 'next/image';
import type React from 'react';
import {
  buttonChrome,
  floatingChromeGlass,
  border as semanticBorders,
  effect as semanticEffects,
  status as semanticStatus,
  surface as semanticSurfaces,
  text as semanticTextRecipes,
  radius as uiRadiusRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';
import { Button } from './Button';
import { cn } from './utils';

export const appTitleBarRecipes = {
  base: [
    'sticky top-0 z-50 border-b backdrop-blur-md backdrop-saturate-[150%]',
    'pt-[env(safe-area-inset-top)]',
  ],
  shell: [...semanticSurfaces.card, ...semanticBorders.divider, ...semanticEffects.glassShadow],
  logo: {
    container: ['flex', 'items-center', 'gap-2', semanticTextRecipes.primary],
    wordmark: uiTypographyRecipes.pageTitle,
    fontFamily: { fontFamily: "'Cal Sans', system-ui, sans-serif" },
  },
  settingsIdle: buttonChrome.settingsIdle.join(' '),
  titleBarGrid: [
    'grid',
    'grid-cols-[minmax(0,1fr)_auto]',
    'grid-rows-[auto_auto]',
    'items-center',
    'gap-x-3',
    'gap-y-2',
    'h-12',
    'md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]',
    'md:grid-rows-1',
    'md:gap-4',
    'md:h-14',
  ],
  pillContainer: [
    `flex items-center gap-1 ${uiRadiusRecipes.standard} border p-1`,
    ...floatingChromeGlass.backdrop,
    ...floatingChromeGlass.shell,
  ],
  pillContainerSize: ['h-12'],
  pillTab: [`relative flex items-center justify-center gap-0 ${uiRadiusRecipes.standard}`],
  pillTabSize: ['h-full px-3.5 py-1.5'],
  pillNav: [
    'hidden',
    'md:flex',
    'col-span-2',
    'row-start-2',
    'flex',
    'justify-center',
    'md:col-span-1',
    'md:col-start-2',
    'md:row-start-1',
    'md:justify-self-center',
  ],
  actions: [
    'col-start-2',
    'row-start-1',
    'flex',
    'items-center',
    'justify-end',
    'gap-2',
    'md:col-start-3',
    'md:justify-self-end',
  ],
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

export const TABS: Array<{
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

export const AppTitleBar = ({
  state,
  isOnline,
  onLogout,
  currentTab,
  onTabChange,
  ref,
}: AppTitleBarProps & { ref?: React.RefObject<HTMLElement | null> }) => {
  const canGoToDashboard = state === 'authenticated' && onTabChange != null;

  const logoMark = (
    <>
      <div className={cn('relative', 'h-8', 'w-8', 'overflow-hidden', uiRadiusRecipes.standard)}>
        <Image
          src="/sumurai-logo.jpeg"
          alt="Sumurai Logo"
          fill
          sizes="32px"
          className="object-cover"
          unoptimized
        />
      </div>
      <span className={uiTypographyRecipes.pageTitle}>Sumurai</span>
    </>
  );

  const logoClassName = cn(...appTitleBarRecipes.logo.container, appTitleBarRecipes.logo.wordmark);

  const primaryTabs = canGoToDashboard ? (
    <nav className={cn(...appTitleBarRecipes.pillNav)} aria-label="Primary">
      <div
        className={cn(...appTitleBarRecipes.pillContainer, ...appTitleBarRecipes.pillContainerSize)}
      >
        {TABS.map(({ key, label, icon: Icon }) => (
          <Button
            key={key}
            type="button"
            onClick={() => onTabChange(key)}
            variant={currentTab === key ? 'tabActive' : 'tab'}
            size="xs"
            aria-label={label}
            aria-current={currentTab === key ? 'page' : undefined}
            className={cn(
              ...appTitleBarRecipes.pillTab,
              ...appTitleBarRecipes.pillTabSize,
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
            <span className="relative z-10 flex h-6 w-6 items-center justify-center shrink-0">
              <Icon className="h-6 w-6" />
            </span>
            <span
              className={cn(
                'relative z-10 overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-300',
                uiTypographyRecipes.bodyStrong,
                currentTab === key ? 'max-w-[8rem] opacity-100' : 'max-w-0 opacity-0'
              )}
            >
              <span className={cn(currentTab === key && 'ml-1.5')}>{label}</span>
            </span>
          </Button>
        ))}
      </div>
    </nav>
  ) : null;

  return (
    <header ref={ref} className={titleBarVariants({ state })}>
      <div className="px-4">
        <div className={cn(...appTitleBarRecipes.titleBarGrid)}>
          <div className={cn('col-start-1', 'row-start-1', 'flex', 'items-center', 'gap-6')}>
            {canGoToDashboard ? (
              <button
                type="button"
                onClick={() => onTabChange('dashboard')}
                className={cn(
                  logoClassName,
                  'cursor-pointer',
                  'rounded-[length:var(--radius-standard)]',
                  'border-0',
                  'bg-transparent',
                  'p-0',
                  'transition-opacity',
                  'duration-200',
                  'hover:opacity-90',
                  'focus-visible:outline-none',
                  'focus-visible:ring-2',
                  'focus-visible:ring-sky-400',
                  'focus-visible:ring-offset-2',
                  'focus-visible:ring-offset-white',
                  'dark:focus-visible:ring-sky-400/80',
                  'dark:focus-visible:ring-offset-slate-900'
                )}
                aria-label="Go to dashboard"
              >
                {logoMark}
              </button>
            ) : (
              <div className={logoClassName}>{logoMark}</div>
            )}
          </div>

          {primaryTabs}

          <div className={cn(...appTitleBarRecipes.actions)}>
            <span role="status" aria-live="polite" title={isOnline ? 'Online' : 'Offline'}>
              {isOnline ? (
                <Wifi className={cn('h-6 w-6', ...semanticStatus.success.icon)} />
              ) : (
                <WifiOff className={cn('h-6 w-6', ...semanticStatus.warning.icon)} />
              )}
            </span>

            {state === 'authenticated' && onTabChange && (
              <Button
                type="button"
                onClick={() => onTabChange('settings')}
                variant={currentTab === 'settings' ? 'tabActive' : 'ghost'}
                size="xs"
                className={cn(
                  currentTab !== 'settings' ? appTitleBarRecipes.settingsIdle : undefined
                )}
                aria-label="Settings"
                title="Settings"
              >
                <Settings className={cn('h-6', 'w-6')} />
              </Button>
            )}

            {(state === 'onboarding' || state === 'authenticated') && onLogout && (
              <>
                <div className="hidden md:block">
                  <Button
                    type="button"
                    onClick={onLogout}
                    variant="danger"
                    size="xs"
                    title="Logout"
                  >
                    <LogOut className="h-6 w-6" />
                    <span>Logout</span>
                  </Button>
                </div>
                <div className="md:hidden">
                  <Button
                    type="button"
                    onClick={onLogout}
                    variant="danger"
                    size="xs"
                    aria-label="Logout"
                  >
                    <LogOut className="h-6 w-6" />
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

AppTitleBar.displayName = 'AppTitleBar';

export default AppTitleBar;
