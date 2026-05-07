import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { LoginScreen } from '@/Auth';
import { useTheme } from '@/context/ThemeContext';
import { AppLayout } from '@/layouts/AppLayout';
import { storyDarkTheme } from '@/storybook/storyDarkTheme';
import { AppFooter, AppTitleBar, cn, GradientShell } from '@/ui/primitives';

function UnauthenticatedLoginShell() {
  const { mode, toggle } = useTheme();

  return (
    <GradientShell className={cn('text-slate-900', 'dark:text-slate-100')}>
      <div className={cn('flex', 'flex-col', 'min-h-screen')}>
        <AppTitleBar
          state="unauthenticated"
          scrolled={false}
          themeMode={mode}
          onThemeToggle={toggle}
        />
        <main className={cn('flex-1', 'flex', 'items-center', 'justify-center')}>
          <LoginScreen onNavigateToRegister={() => {}} />
        </main>
        <AppFooter />
      </div>
    </GradientShell>
  );
}

function AuthenticatedDashboardShell() {
  return (
    <AppLayout
      currentTab="dashboard"
      onTabChange={() => {}}
      onLogout={() => {}}
      renderAccountFilter={() => (
        <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 dark:border-slate-600 dark:text-slate-300">
          All accounts
        </span>
      )}
    >
      <div className="mx-auto max-w-5xl rounded-2xl border border-slate-200 bg-white/50 p-8 dark:border-slate-700 dark:bg-slate-900/35">
        Authenticated tab surface placeholder
      </div>
    </AppLayout>
  );
}

const meta = {
  title: 'Storybook/AppChrome',
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const UnauthenticatedLogin: Story = {
  render: () => <UnauthenticatedLoginShell />,
};

export const UnauthenticatedLoginDark: Story = {
  ...storyDarkTheme,
  render: () => <UnauthenticatedLoginShell />,
};

export const AuthenticatedDashboard: Story = {
  render: () => <AuthenticatedDashboardShell />,
};

export const AuthenticatedDashboardDark: Story = {
  ...storyDarkTheme,
  render: () => <AuthenticatedDashboardShell />,
};
