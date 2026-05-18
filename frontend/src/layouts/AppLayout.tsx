import { motion } from 'framer-motion';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { cn } from '@/ui/primitives';
import { appTitleBarRecipes, TABS } from '@/ui/primitives/AppTitleBar';
import { Button } from '@/ui/primitives/Button';
import { HeaderAccountFilter } from '../components/HeaderAccountFilter';
import { useScrollDetection } from '../hooks/useScrollDetection';
import { AppFooter, AppTitleBar } from '../ui/primitives';
import { text as semanticTextRecipes } from '../ui/recipes';

export type TabKey = 'dashboard' | 'transactions' | 'budgets' | 'accounts' | 'settings';

interface AppLayoutProps {
  children: ReactNode;
  currentTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  onLogout: () => void;
  isOnline: boolean;
  className?: string;
  bottomBarContent?: ReactNode;
  bottomBarAboveTabsUntil?: 'md' | 'lg';
}

export function AppLayout({
  children,
  currentTab,
  onTabChange,
  onLogout,
  isOnline,
  className,
  bottomBarContent,
  bottomBarAboveTabsUntil = 'md',
}: AppLayoutProps) {
  const stackedBottomBarVisibility = bottomBarAboveTabsUntil === 'lg' ? 'lg:hidden' : 'md:hidden';
  const floatingBottomBarVisibility =
    bottomBarAboveTabsUntil === 'lg' ? 'hidden lg:flex' : 'hidden md:flex';
  const mainBottomPadding =
    bottomBarAboveTabsUntil === 'lg'
      ? 'pb-[calc(5.75rem_+_env(safe-area-inset-bottom))] lg:pb-8'
      : 'pb-[calc(5.75rem_+_env(safe-area-inset-bottom))] md:pb-6 lg:pb-8';
  const scrolled = useScrollDetection();
  const footerRef = useRef<HTMLDivElement>(null);
  const [floatingVisible, setFloatingVisible] = useState(true);

  useEffect(() => {
    const el = footerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setFloatingVisible(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const showBottomAccountFilter = currentTab !== 'accounts';

  const bottomBarRow = (
    <div
      className={cn(
        'grid w-full items-center gap-2',
        showBottomAccountFilter ? 'grid-cols-[1fr_auto_1fr]' : 'grid-cols-1 justify-items-center'
      )}
    >
      {showBottomAccountFilter ? <div aria-hidden className={cn('min-w-0')} /> : null}
      <div
        className={cn(
          'flex min-w-0 max-w-full justify-center',
          showBottomAccountFilter && 'justify-self-center'
        )}
      >
        {bottomBarContent}
      </div>
      {showBottomAccountFilter ? (
        <div className={cn('flex min-w-0 items-center justify-end')}>
          <HeaderAccountFilter triggerStyle="icon-only" />
        </div>
      ) : null}
    </div>
  );

  return (
    <div className={cn('flex', 'min-h-screen', 'flex-col', className)}>
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
            'pl-[calc(1rem_+_env(safe-area-inset-left))] pr-[calc(1rem_+_env(safe-area-inset-right))]',
            'md:pl-[calc(3rem_+_env(safe-area-inset-left))] md:pr-[calc(3rem_+_env(safe-area-inset-right))]',
            'lg:pl-[calc(4rem_+_env(safe-area-inset-left))] lg:pr-[calc(4rem_+_env(safe-area-inset-right))]',
            'pt-3 md:pt-6 lg:pt-8',
            mainBottomPadding
          )}
        >
          {children}
        </main>

        {/* Desktop bottom controls */}
        <div
          className={cn(
            'fixed bottom-5 left-0 right-0 z-50',
            floatingBottomBarVisibility,
            'min-h-[2.75rem] px-4',
            'transition-opacity duration-200',
            floatingVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
          )}
        >
          {bottomBarRow}
        </div>

        {/* Mobile bottom navigation bar */}
        <div
          className={cn(
            'fixed bottom-4 left-0 right-0',
            stackedBottomBarVisibility,
            'z-50',
            'flex flex-col',
            'pb-[env(safe-area-inset-bottom)]',
            'transition-opacity duration-200',
            floatingVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
          )}
        >
          <div className={cn('min-h-[3.25rem] px-4')}>{bottomBarRow}</div>

          <div className={cn('flex justify-center pt-1 pb-2')}>
            <nav className={cn(...appTitleBarRecipes.pillContainer)} aria-label="Mobile primary">
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
                    currentTab === key ? semanticTextRecipes.inverse : semanticTextRecipes.muted
                  )}
                >
                  {currentTab === key ? (
                    <motion.div
                      layoutId="mobile-pill-active"
                      data-slot="active-pill"
                      className={cn('absolute inset-0 rounded-[length:inherit] bg-[inherit]')}
                      transition={{ stiffness: 400, damping: 35 }}
                    />
                  ) : null}
                  <span className="relative z-10 flex h-4 w-4 items-center justify-center shrink-0">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span
                    className={cn(
                      'relative z-10 overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-300',
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

        <div ref={footerRef}>
          <AppFooter />
        </div>
      </div>
    </div>
  );
}

export default AppLayout;
