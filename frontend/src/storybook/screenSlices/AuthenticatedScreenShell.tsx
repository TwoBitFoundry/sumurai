import type { ReactNode } from 'react';
import { AppLayout, type TabKey } from '@/layouts/AppLayout';

export function AuthenticatedScreenShell(props: { currentTab: TabKey; children: ReactNode }) {
  return (
    <AppLayout
      currentTab={props.currentTab}
      onTabChange={() => {}}
      onLogout={() => {}}
      renderAccountFilter={() => (
        <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 dark:border-slate-600 dark:text-slate-300">
          All accounts
        </span>
      )}
    >
      {props.children}
    </AppLayout>
  );
}
