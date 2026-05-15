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
            'pl-[calc(2rem_+_env(safe-area-inset-left))] pr-[calc(2rem_+_env(safe-area-inset-right))]',
            'sm:pl-[calc(3rem_+_env(safe-area-inset-left))] sm:pr-[calc(3rem_+_env(safe-area-inset-right))]',
            'lg:pl-[calc(4rem_+_env(safe-area-inset-left))] lg:pr-[calc(4rem_+_env(safe-area-inset-right))]',
            'pt-4 sm:pt-6 lg:pt-8',
            'pb-4 md:pb-6 lg:pb-8'
          )}
        >
          {children}
        </main>

        {/* Desktop bottom controls */}
        <div
          className={cn(
            'fixed bottom-5 left-0 right-0 z-50',
            'hidden md:flex',
            'min-h-[2.75rem] items-center justify-center px-4',
            'transition-opacity duration-200',
            floatingVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
          )}
        >
          {bottomBarContent}
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <HeaderAccountFilter triggerStyle="icon-only" />
          </div>
        </div>

        {/* Mobile bottom navigation bar */}
        <div
          className={cn(
            'fixed bottom-4 left-0 right-0',
            'md:hidden',
            'z-50',
            'flex flex-col',
            'pb-[env(safe-area-inset-bottom)]',
            'transition-opacity duration-200',
            floatingVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
          )}
        >
          <div className={cn('relative flex min-h-[3.25rem] items-center justify-center px-4')}>
            {bottomBarContent}
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <HeaderAccountFilter triggerStyle="icon-only" />
            </div>
          </div>

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
                  <Icon className="relative z-10 h-4 w-4" />
                  <span
                    className={cn(
                      'relative z-10 overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-300',
                      currentTab === key ? 'max-w-[8rem] opacity-100' : 'max-w-0 opacity-0'
                    )}
                  >
                    {label}
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
