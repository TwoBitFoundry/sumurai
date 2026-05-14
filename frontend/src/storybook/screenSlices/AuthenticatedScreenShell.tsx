import type { ReactNode } from 'react';
import { AppLayout, type TabKey } from '@/layouts/AppLayout';
import { AccountFilterStoryProvider } from '@/storybook/AccountFilterStoryProvider';

export function AuthenticatedScreenShell(props: { currentTab: TabKey; children: ReactNode }) {
  return (
    <AccountFilterStoryProvider>
      <AppLayout currentTab={props.currentTab} onTabChange={() => {}} onLogout={() => {}} isOnline>
        {props.children}
      </AppLayout>
    </AccountFilterStoryProvider>
  );
}
