import type { ReactNode } from 'react';
import { AppLayout, type TabKey } from '@/layouts/AppLayout';
export function AuthenticatedScreenShell(props: { currentTab: TabKey; children: ReactNode }) {
  return (
    <AppLayout currentTab={props.currentTab} onTabChange={() => {}} onLogout={() => {}} isOnline>
      {props.children}
    </AppLayout>
  );
}
