import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { cn } from '@/ui/primitives';
import {
  APP_TITLE_BAR_ACTIVE_PILL_LAYOUT_ID,
  appTitleBarRecipes,
  TABS,
} from '@/ui/primitives/AppTitleBar';
import { Button } from '@/ui/primitives/Button';
import { useFloatingChromeFooterVisibility } from '../hooks/useFloatingChromeFooterVisibility';
import { useScrollDetection } from '../hooks/useScrollDetection';
import { AppFooter, AppTitleBar } from '../ui/primitives';
import { appLayout, text as semanticTextRecipes, font as uiTypographyRecipes } from '../ui/recipes';

export type TabKey = 'dashboard' | 'transactions' | 'budgets' | 'accounts' | 'settings';

interface AppLayoutProps {
  children: ReactNode;
  currentTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  onLogout: () => void;
  isOnline: boolean;
  className?: string;
  bottomBarContent?: ReactNode;
}

export function AppLayout({
  children,
  currentTab,
  onTabChange,
  onLogout,
  isOnline,
  className,
  bottomBarContent,
}: AppLayoutProps) {
  const mainBottomPadding = bottomBarContent
    ? 'pb-[calc(8.75rem_+_env(safe-area-inset-bottom))] md:pb-[calc(6rem_+_env(safe-area-inset-bottom))]'
    : 'pb-[calc(3.75rem_+_env(safe-area-inset-bottom))]';
  const scrolled = useScrollDetection();
  const showFooter = currentTab === 'dashboard';
  const showBottomChromeRow = Boolean(bottomBarContent);
  const { floatingVisible, floatingChromeRef, footerSentinelRef } =
    useFloatingChromeFooterVisibility(showFooter);

  const bottomBarRow = (
    <div className={cn(floatingVisible && 'pointer-events-auto')}>{bottomBarContent}</div>
  );

  return (
    <div className={cn('flex', 'min-h-dvh', 'flex-col', className)}>
      <div className={cn('relative', 'z-10', 'flex', 'flex-1', 'flex-col')}>
        <AppTitleBar
          state="authenticated"
          scrolled={scrolled}
          isOnline={isOnline}
          onLogout={onLogout}
          currentTab={currentTab}
          onTabChange={onTabChange}
        />

        <main
          className={cn(
            'flex-1',
            'overflow-hidden',
            ...appLayout.mainSafeArea,
            'pt-3 md:pt-6 lg:pt-8',
            mainBottomPadding
          )}
        >
          <div className={cn(...appLayout.contentShellWithGutter, 'min-w-0')}>{children}</div>
        </main>

        <div
          ref={floatingChromeRef}
          className={cn(
            'fixed',
            'bottom-4',
            'left-0',
            'right-0',
            'z-50',
            'flex',
            'flex-col',
            'pointer-events-none',
            'pb-[env(safe-area-inset-bottom)]',
            'transition-opacity',
            'duration-200',
            floatingVisible ? 'opacity-100' : 'opacity-0'
          )}
        >
          {showBottomChromeRow ? (
            <div
              className={cn(
                'flex',
                'min-h-[3.25rem]',
                'justify-center',
                'pointer-events-none',
                ...appTitleBarRecipes.floatingChromeGutter
              )}
            >
              {bottomBarRow}
            </div>
          ) : null}

          <div
            aria-hidden
            className={cn('hidden', 'md:block', 'h-[2rem]', 'pointer-events-none')}
          />

          <div
            className={cn(
              'flex',
              'justify-center',
              'pointer-events-none',
              ...appTitleBarRecipes.floatingChromeGutter,
              'pt-1',
              'pb-2',
              'md:hidden'
            )}
          >
            <nav
              className={cn(
                ...appTitleBarRecipes.pillContainer,
                ...appTitleBarRecipes.contextPillInset,
                ...appTitleBarRecipes.pillContainerSize,
                floatingVisible && 'pointer-events-auto'
              )}
              aria-label="Primary"
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
                    ...appTitleBarRecipes.contextPillTabSize,
                    'shrink-0',
                    'gap-1.5',
                    currentTab === key ? semanticTextRecipes.inverse : semanticTextRecipes.muted
                  )}
                >
                  {currentTab === key ? (
                    <motion.div
                      layout
                      layoutId={`${APP_TITLE_BAR_ACTIVE_PILL_LAYOUT_ID}-mobile`}
                      data-slot="active-pill"
                      className={cn('absolute inset-0 rounded-[length:inherit] bg-[inherit]')}
                      transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                    />
                  ) : null}
                  <span
                    className={cn(
                      'relative',
                      'z-10',
                      'shrink-0',
                      ...appTitleBarRecipes.pillTabIconWell
                    )}
                  >
                    <Icon className={cn(...appTitleBarRecipes.pillTabIcon)} />
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
            </nav>
          </div>
        </div>

        {showFooter ? (
          <div>
            <span
              ref={footerSentinelRef}
              className={cn('pointer-events-none', 'block', 'h-px', 'w-full')}
              aria-hidden
              data-testid="footer-intersection-sentinel"
            />
            <AppFooter />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default AppLayout;
