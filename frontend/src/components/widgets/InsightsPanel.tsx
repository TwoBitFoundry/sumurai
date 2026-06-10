import type { CSSProperties, ReactNode } from 'react';
import { useViewportBreakpoint } from '@/hooks/useViewportBreakpoint';
import { cn } from '@/ui/primitives';
import {
  text as semanticTextRecipes,
  border as uiBorderRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';
import { type HeroAccent, heroAccents } from '@/ui/tokens';

export interface InsightsPanelProps {
  testId: string;
  accent: HeroAccent;
  headerLabel?: ReactNode;
  isLoading?: boolean;
  children: ReactNode;
  bodyClassName?: string;
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
  const shellAccent = heroAccents[accent];

  return (
    <section
      data-testid={testId}
      className={cn(
        'relative',
        'overflow-hidden',
        'rounded-[0.75rem]',
        'border-2',
        shellAccent.border,
        shellAccent.borderDark,
        'bg-white/80',
        'transition-colors',
        'duration-200',
        'dark:bg-[#111a2f]/70'
      )}
    >
      <div
        className={cn(
          'hero-stat-card__gradient',
          'pointer-events-none',
          'absolute',
          'inset-0',
          'rounded-[inherit]',
          'opacity-0',
          'transition-opacity',
          'duration-300',
          'group-hover:opacity-100'
        )}
        style={{
          backgroundImage: `linear-gradient(135deg, ${shellAccent.gradFrom}33, ${shellAccent.gradVia}1f, transparent 70%)`,
        }}
      />
      <div
        className={cn(
          'pointer-events-none',
          'absolute',
          'inset-[2px]',
          'rounded-[calc(0.75rem-2px)]'
        )}
      >
        <div
          className={cn('absolute', 'inset-0', 'rounded-[inherit]', 'ring-2')}
          style={{ '--tw-ring-color': `${shellAccent.ringHex}66` } as CSSProperties}
        />
      </div>

      <div className={cn('relative', 'z-10', 'px-3', 'py-2', 'md:px-4', 'md:py-3')}>
        {headerLabel != null ? (
          <>
            <div
              className={cn(
                'mb-2',
                'flex',
                'items-center',
                'justify-between',
                'gap-2',
                uiTypographyRecipes.label,
                semanticTextRecipes.subtle
              )}
            >
              <span>{headerLabel}</span>
              {isLoading ? (
                <span className={cn(uiTypographyRecipes.caption, semanticTextRecipes.muted)}>
                  Loading…
                </span>
              ) : null}
            </div>
            <div className={cn('border-b', ...uiBorderRecipes.divider, 'mb-2')} />
          </>
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
    </section>
  );
}

export default InsightsPanel;
