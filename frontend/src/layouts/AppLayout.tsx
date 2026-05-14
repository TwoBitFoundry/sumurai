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
          className={`flex-1 overflow-hidden px-8 sm:px-12 lg:px-16 py-4 sm:py-6 lg:py-8 ${currentTab === 'dashboard' ? 'pb-16' : ''}`}
        >
          {children}
        </main>

        <div
          data-bottom-bar-controls
          className={cn('fixed', 'bottom-5', 'right-4', 'z-50', 'flex', 'items-center', 'gap-2')}
        >
          <HeaderAccountFilter triggerStyle="icon-only" />
          {bottomBarContent}
        </div>

        <AppFooter />
      </div>
    </div>
  );
}

export default AppLayout;
