import type { ReactNode } from 'react';
import { cn } from '@/ui/primitives';
import { HeaderAccountFilter } from '../components/HeaderAccountFilter';
import { useScrollDetection } from '../hooks/useScrollDetection';
import { AppFooter, AppTitleBar } from '../ui/primitives';

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
            'pt-16 md:pt-6 lg:pt-8',
            'pb-4 sm:pb-6 lg:pb-8',
            currentTab === 'dashboard' ? 'pb-16' : ''
          )}
        >
          {children}
        </main>

        <div
          data-bottom-bar-controls
          className={cn(
            'fixed',
            'bottom-[calc(1.25rem_+_env(safe-area-inset-bottom))]',
            'right-[calc(1rem_+_env(safe-area-inset-right))]',
            'z-50',
            'flex',
            'items-center',
            'gap-2'
          )}
        >
          {bottomBarContent}
          <HeaderAccountFilter triggerStyle="icon-only" />
        </div>

        <AppFooter />
      </div>
    </div>
  );
}

export default AppLayout;
