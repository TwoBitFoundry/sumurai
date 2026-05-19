import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { LoginScreen } from '@/Auth';
import { AppLayout } from '@/layouts/AppLayout';
import { AccountFilterStoryProvider } from '@/storybook/AccountFilterStoryProvider';
import { storyDarkTheme } from '@/storybook/storyDarkTheme';
import { AppFooter, AppTitleBar, cn, GradientShell } from '@/ui/primitives';
import { radius as uiRadiusRecipes, text as uiTextRecipes } from '@/ui/recipes';

function UnauthenticatedLoginShell() {
  return (
    <GradientShell className={cn(uiTextRecipes.primary)}>
      <div className={cn('flex', 'flex-col', 'min-h-screen')}>
        <AppTitleBar state="unauthenticated" scrolled={false} isOnline />
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
    <AccountFilterStoryProvider>
      <AppLayout currentTab="dashboard" onTabChange={() => {}} onLogout={() => {}} isOnline>
        <div
          className={`mx-auto max-w-5xl ${uiRadiusRecipes.standard} border border-slate-200 bg-white/50 p-8 dark:border-slate-700 dark:bg-slate-900/35`}
        >
          Authenticated tab surface placeholder
        </div>
      </AppLayout>
    </AccountFilterStoryProvider>
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
