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
  settingsIdle:
    'border border-[var(--color-border-divider)] dark:border-[var(--color-border-divider)] bg-[var(--color-surface-muted-chip)] dark:bg-[var(--color-surface-muted-chip)] hover:bg-[var(--color-surface-hover-row)] dark:hover:bg-[var(--color-surface-hover-row)]',
  pillContainer: [
    `flex h-11 items-center gap-1 ${uiRadiusRecipes.standard} border p-1 backdrop-blur-md backdrop-saturate-[150%]`,
    ...semanticSurfaces.glassPanel,
    ...semanticBorders.glass,
    ...semanticEffects.glassShadow,
  ],
  pillTab: [
    `relative flex h-full items-center justify-center gap-0 ${uiRadiusRecipes.standard} px-3 py-1.5`,
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
  return (
    <header ref={ref} className={titleBarVariants({ state })}>
      <div className="px-4">
        <div className="flex h-12 items-center justify-between md:h-16">
          <div className={cn('flex', 'items-center', 'gap-6')}>
            <div
              className={cn(...appTitleBarRecipes.logo.container, appTitleBarRecipes.logo.wordmark)}
            >
              <div
                className={cn(
                  'relative',
                  'h-8',
                  'w-8',
                  'overflow-hidden',
                  uiRadiusRecipes.standard
                )}
              >
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
            </div>
          </div>

          <div className={cn('flex', 'items-center', 'gap-2')}>
            <span role="status" aria-live="polite" title={isOnline ? 'Online' : 'Offline'}>
              {isOnline ? (
                <Wifi className={cn('h-4 w-4', ...semanticStatus.success.icon)} />
              ) : (
                <WifiOff className={cn('h-4 w-4', ...semanticStatus.warning.icon)} />
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
                <Settings className={cn('h-4', 'w-4')} />
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
                    <LogOut className="h-4 w-4" />
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
                    <LogOut className="h-4 w-4" />
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
