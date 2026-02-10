import { type ReactNode } from 'react';
import { AppTitleBar, AppFooter } from '../ui/primitives';
import { useTheme } from '../context/ThemeContext';
import { HeaderAccountFilter } from '../components/HeaderAccountFilter';
import { useScrollDetection } from '../hooks/useScrollDetection';
import { cn } from '@/ui/primitives';

type TabKey = 'dashboard' | 'transactions' | 'budgets' | 'accounts' | 'settings';

interface AppLayoutProps {
  children: ReactNode;
  currentTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  onLogout: () => void;
  className?: string;
}

export function AppLayout({
  children,
  currentTab,
  onTabChange,
  onLogout,
  className,
}: AppLayoutProps) {
  const scrolled = useScrollDetection();
  const { mode, toggle } = useTheme();

  return (
    <div className={className}>
      <div className={cn('relative', 'z-10', 'flex', 'min-h-screen', 'flex-col')}>
        <AppTitleBar
          state="authenticated"
          scrolled={scrolled}
          themeMode={mode}
          onThemeToggle={toggle}
          onLogout={onLogout}
          currentTab={currentTab}
          onTabChange={onTabChange}
          accountFilterNode={<HeaderAccountFilter scrolled={scrolled} />}
        />

        <main
          className={`flex-1 px-8 sm:px-12 lg:px-16 py-4 sm:py-6 lg:py-8 ${currentTab === 'dashboard' ? 'pb-28' : ''}`}
        >
          {children}
        </main>

        <AppFooter />
      </div>
    </div>
  );
}

export default AppLayout;
