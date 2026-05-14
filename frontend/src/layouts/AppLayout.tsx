import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { cn } from '@/ui/primitives';
import { appTitleBarRecipes, TABS } from '@/ui/primitives/AppTitleBar';
import { Button, buttonRecipes } from '@/ui/primitives/Button';
import { HeaderAccountFilter } from '../components/HeaderAccountFilter';
import { useScrollDetection } from '../hooks/useScrollDetection';
import { AppFooter, AppTitleBar } from '../ui/primitives';
import {
  border as semanticBorders,
  effect as semanticEffects,
  surface as semanticSurfaces,
  text as semanticTextRecipes,
} from '../ui/recipes';

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

  return (
    <div className={className}>
      <div className={cn('relative', 'z-10', 'flex', 'min-h-screen', 'flex-col')}>
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
            'flex-1 overflow-hidden',
            'pl-[calc(2rem_+_env(safe-area-inset-left))] pr-[calc(2rem_+_env(safe-area-inset-right))]',
            'sm:pl-[calc(3rem_+_env(safe-area-inset-left))] sm:pr-[calc(3rem_+_env(safe-area-inset-right))]',
            'lg:pl-[calc(4rem_+_env(safe-area-inset-left))] lg:pr-[calc(4rem_+_env(safe-area-inset-right))]',
            'pt-4 sm:pt-6 lg:pt-8',
            'pb-40 md:pb-6 lg:pb-8'
          )}
        >
          {children}
        </main>

        {/* Mobile bottom navigation bar */}
        <div
          className={cn(
            'fixed bottom-0 left-0 right-0',
            'md:hidden',
            'z-50',
            'flex flex-col',
            ...semanticSurfaces.card,
            'border-t',
            ...semanticBorders.divider,
            ...semanticEffects.glassShadow,
            'backdrop-blur-md backdrop-saturate-[150%]',
            'pb-[env(safe-area-inset-bottom)]'
          )}
        >
          <div className={cn('flex items-center justify-end gap-2 px-4 pt-2')}>
            {bottomBarContent}
            <HeaderAccountFilter triggerStyle="icon-only" />
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

        <AppFooter />
      </div>
    </div>
  );
}

export default AppLayout;
