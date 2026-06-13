import type { ReactNode } from 'react';
import { useViewportBreakpoint } from '@/hooks/useViewportBreakpoint';
import { cn } from '@/ui/primitives';
import { text as semanticTextRecipes, font as uiTypographyRecipes } from '@/ui/recipes';
import type { HeroAccent } from '@/ui/tokens';
import { InsightsPanelShell } from './InsightsPanelShell';

export interface InsightsPanelProps {
  testId: string;
  accent: HeroAccent;
  headerLabel?: ReactNode;
  isLoading?: boolean;
  children: ReactNode;
  bodyClassName?: string;
}

export interface InsightsPanelHeaderProps {
  label: ReactNode;
  isLoading?: boolean;
}

export function InsightsPanelHeader({ label, isLoading = false }: InsightsPanelHeaderProps) {
  return (
    <div className={cn('flex', 'items-center', 'justify-between', 'gap-2')}>
      <h3 className={cn(uiTypographyRecipes.cardTitle, semanticTextRecipes.primary)}>{label}</h3>
      {isLoading ? (
        <span className={cn(uiTypographyRecipes.caption, semanticTextRecipes.muted)}>Loading…</span>
      ) : null}
    </div>
  );
}

export function InsightsPanel({
  testId,
  accent,
  headerLabel,
  isLoading = false,
  children,
  bodyClassName,
}: InsightsPanelProps) {
  const { isMobile } = useViewportBreakpoint();

  return (
    <InsightsPanelShell testId={testId} accent={accent}>
      <div className={cn('relative', 'z-10', 'px-3', 'py-2', 'md:px-4', 'md:py-3')}>
        {headerLabel != null ? (
          <div className="mb-3">
            <InsightsPanelHeader label={headerLabel} isLoading={isLoading} />
          </div>
        ) : null}
        <div
          className={cn(
            isMobile
              ? 'grid grid-cols-[auto_1fr_auto_auto_auto] items-baseline gap-x-2 gap-y-1.5'
              : 'flex flex-row items-start gap-3',
            bodyClassName
          )}
        >
          {children}
        </div>
      </div>
    </InsightsPanelShell>
  );
}

export default InsightsPanel;
