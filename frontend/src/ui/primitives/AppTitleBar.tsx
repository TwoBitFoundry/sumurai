import { cva } from 'class-variance-authority';
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
  appLayout,
  buttonChrome,
  chromeBar,
  control,
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
import { IconButton } from './IconButton';
import { cn } from './utils';

export const appTitleBarRecipes = {
  base: [
    'sticky top-0 z-50 border-b',
    ...semanticEffects.glassBackdrop,
    'pt-[env(safe-area-inset-top)]',
  ],
  shell: [...semanticSurfaces.card, ...semanticBorders.divider, ...semanticEffects.glassShadow],
  logo: {
    container: ['flex', 'h-full', 'min-h-0', 'items-center', 'gap-2', semanticTextRecipes.primary],
    image: [
      'relative',
      'aspect-square',
      'shrink-0',
      'overflow-hidden',
      chromeBar.height,
      'w-12',
      uiRadiusRecipes.standard,
    ],
    wordmark: [uiTypographyRecipes.pageTitle, 'leading-none'],
    fontFamily: { fontFamily: "'Cal Sans', system-ui, sans-serif" },
  },
  settingsIdle: buttonChrome.settingsIdle.join(' '),
  actionIcon: ['shrink-0'],
  titleBarGrid: [
    'grid',
    'grid-cols-[minmax(0,1fr)_auto]',
    'grid-rows-1',
    'items-center',
    'max-md:content-center',
    'gap-x-3',
    'min-h-14',
    'h-14',
    'md:grid-cols-[auto_minmax(0,1fr)_auto]',
    'md:gap-4',
  ],
  titleBarRow: ['flex', 'h-full', 'min-h-0', 'items-center'],
  pillContainer: [
    `flex items-center gap-1 ${uiRadiusRecipes.standard} border`,
    ...floatingChromeGlass.backdrop,
    ...floatingChromeGlass.shell,
  ],
  pillInset: ['p-2', 'md:p-3'],
  floatingChromeGutter: [...appLayout.contentShellWithGutter],
  pillContainerSize: [chromeBar.height],
  pillTab: [
    `relative flex h-full min-h-0 items-center justify-center gap-0 ${uiRadiusRecipes.standard}`,
  ],
  pillTabSize: ['px-3.5', 'lg:px-3'],
  contextPillInset: ['py-1.5', 'px-2', 'md:py-2', 'md:px-2.5'],
  tabBarShadow: [
    'drop-shadow-[0_10px_12px_rgba(15,23,42,0.28)]',
    'md:drop-shadow-[0_12px_16px_rgba(15,23,42,0.28)]',
    'dark:drop-shadow-[0_10px_12px_rgba(148,163,184,0.22)]',
    'dark:md:drop-shadow-[0_12px_16px_rgba(148,163,184,0.22)]',
    'lg:drop-shadow-none',
  ],
  bottomBarShadow: [
    'drop-shadow-[0_-8px_12px_rgba(15,23,42,0.28)]',
    'md:drop-shadow-[0_-10px_14px_rgba(15,23,42,0.28)]',
    'dark:drop-shadow-[0_-8px_12px_rgba(148,163,184,0.22)]',
    'dark:md:drop-shadow-[0_-10px_14px_rgba(148,163,184,0.22)]',
    'lg:drop-shadow-none',
  ],
  contextPillTab: [
    'relative',
    'flex',
    'h-full',
    'min-h-0',
    'items-center',
    'justify-center',
    'rounded-lg',
  ],
  contextPillTabSize: ['px-2.5'],
  settingsPillInset: ['p-1.5', 'px-2', 'md:py-1', 'md:px-1.5'],
  settingsPillSize: ['h-12', 'md:h-9', 'lg:h-8'],
  pillTabIconWell: [...chromeBar.glyphWell, 'lg:h-4', 'lg:w-4'],
  pillTabIcon: [chromeBar.glyph, 'lg:h-4', 'lg:w-4'],
  pillNav: [
    'hidden',
    'md:flex',
    'md:col-start-2',
    'md:row-start-1',
    'md:justify-self-center',
    'md:items-center',
  ],
  actions: [
    'col-start-2',
    'row-start-1',
    'flex',
    'h-full',
    'min-h-0',
    'min-w-0',
    'shrink-0',
    'items-center',
    'justify-end',
    'gap-3',
    'pl-2',
    'md:col-start-3',
    'md:justify-self-end',
    'md:pl-4',
    'lg:gap-3',
  ],
  statusFrame: ['inline-flex', 'shrink-0', 'items-center', 'justify-center', control.square.md],
  statusWell: [
    'inline-flex',
    'items-center',
    'justify-center',
    control.glyph.md,
    '[&_svg]:block',
    '[&_svg]:h-full',
    '[&_svg]:w-full',
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
      <div className={cn(...appTitleBarRecipes.logo.image)}>
        <Image
          src="/sumurai-hero.webp"
          alt="Sumurai Logo"
          fill
          sizes="48px"
          className="object-cover"
          unoptimized
        />
      </div>
      <span className={cn(...appTitleBarRecipes.logo.wordmark)}>Sumurai</span>
    </>
  );

  const logoClassName = cn(...appTitleBarRecipes.logo.container, appTitleBarRecipes.logo.wordmark);

  const primaryTabs = canGoToDashboard ? (
    <nav className={cn(...appTitleBarRecipes.pillNav)} aria-label="Primary">
      <div
        className={cn(
          ...appTitleBarRecipes.pillContainer,
          ...appTitleBarRecipes.contextPillInset,
          ...appTitleBarRecipes.pillContainerSize,
          ...appTitleBarRecipes.tabBarShadow,
          'max-w-full',
          'min-w-0'
        )}
      >
        {TABS.map(({ key, label, icon: Icon }) => (
          <Button
            key={key}
            type="button"
            onClick={() => onTabChange(key)}
            variant={currentTab === key ? 'tabActive' : 'tab'}
            size="inherit"
            aria-label={label}
            aria-current={currentTab === key ? 'page' : undefined}
            className={cn(
              ...appTitleBarRecipes.contextPillTab,
              'shrink-0',
              currentTab === key
                ? [...appTitleBarRecipes.contextPillTabSize, 'gap-1.5', semanticTextRecipes.inverse]
                : ['!px-0', 'aspect-square', '!gap-0', semanticTextRecipes.muted]
            )}
          >
            <span className={cn('relative z-10 shrink-0', ...appTitleBarRecipes.pillTabIconWell)}>
              <Icon className={cn(...appTitleBarRecipes.pillTabIcon)} />
            </span>
            <span
              className={cn(
                'relative z-10 overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-300',
                uiTypographyRecipes.bodyStrong,
                currentTab === key ? 'max-w-[13ch] opacity-100' : 'max-w-0 opacity-0'
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
      <div className={cn(...appLayout.contentShellWithGutter)}>
        <div className={cn(...appTitleBarRecipes.titleBarGrid)}>
          <div
            className={cn('col-start-1', 'row-start-1', ...appTitleBarRecipes.titleBarRow, 'gap-6')}
          >
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
            <span
              className={cn(...appTitleBarRecipes.statusFrame)}
              role="status"
              aria-live="polite"
              title={isOnline ? 'Online' : 'Offline'}
            >
              <span className={cn(...appTitleBarRecipes.statusWell)}>
                {isOnline ? (
                  <Wifi className={cn(...semanticStatus.success.icon)} />
                ) : (
                  <WifiOff className={cn(...semanticStatus.warning.icon)} />
                )}
              </span>
            </span>

            {state === 'authenticated' && onTabChange && (
              <IconButton
                type="button"
                onClick={() => onTabChange('settings')}
                variant={currentTab === 'settings' ? 'tabActive' : 'toolbar'}
                size="md"
                className={cn(...appTitleBarRecipes.actionIcon)}
                aria-label="Settings"
                title="Settings"
              >
                <Settings />
              </IconButton>
            )}

            {(state === 'onboarding' || state === 'authenticated') && onLogout && (
              <Button
                type="button"
                onClick={onLogout}
                variant="danger"
                size="md"
                className={cn(
                  ...appTitleBarRecipes.actionIcon,
                  'normal-case',
                  'aspect-square',
                  '!px-0',
                  'md:aspect-auto',
                  'md:gap-2',
                  'md:!px-3'
                )}
                aria-label="Log off"
                title="Log off"
              >
                <LogOut className={cn(control.glyph.md)} />
                <span className={cn('hidden', 'md:inline')}>Log off</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

AppTitleBar.displayName = 'AppTitleBar';

export default AppTitleBar;
