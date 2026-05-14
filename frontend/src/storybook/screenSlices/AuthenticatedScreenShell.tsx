import type { ReactNode } from 'react';
import { AppLayout, type TabKey } from '@/layouts/AppLayout';
import { cn } from '@/ui/primitives/utils';
import { text as uiTextRecipes, font as uiTypographyRecipes } from '@/ui/recipes';

export function AuthenticatedScreenShell(props: { currentTab: TabKey; children: ReactNode }) {
  return (
    <AppLayout
      currentTab={props.currentTab}
      onTabChange={() => {}}
      onLogout={() => {}}
      isOnline
      renderAccountFilter={() => (
        <span
          className={cn(
            'rounded-full',
            'border',
            'border-slate-200',
            'px-3',
            'py-1',
            uiTypographyRecipes.caption,
            'font-medium',
            'dark:border-slate-600',
            uiTextRecipes.muted
          )}
        >
          Filter
        </span>
      )}
    >
      {props.children}
    </AppLayout>
  );
}
