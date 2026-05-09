import type { ReactNode } from 'react';
import { AppLayout, type TabKey } from '@/layouts/AppLayout';
import { cn } from '@/ui/primitives/utils';
import { designTokens } from '@/ui/tokens';

export function AuthenticatedScreenShell(props: { currentTab: TabKey; children: ReactNode }) {
  return (
    <AppLayout
      currentTab={props.currentTab}
      onTabChange={() => {}}
      onLogout={() => {}}
      renderAccountFilter={() => (
        <span
          className={cn(
            'rounded-full',
            'border',
            'border-slate-200',
            'px-3',
            'py-1',
            designTokens.typography.caption,
            'font-medium',
            'dark:border-slate-600',
            designTokens.text.muted
          )}
        >
          All accounts
        </span>
      )}
    >
      {props.children}
    </AppLayout>
  );
}
