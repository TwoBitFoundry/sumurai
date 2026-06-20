import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, type LucideIcon } from 'lucide-react';
import type React from 'react';
import { useLayoutEffect } from 'react';
import { useSessionCollapsible } from '@/hooks/useSessionCollapsible';
import { cn } from '@/ui/primitives';
import {
  control,
  controlIconWell,
  border as uiBorderRecipes,
  insightsPanel as uiInsightsPanelRecipes,
  text as uiTextRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';

export interface CollapsibleSectionProps {
  sectionId: string;
  title: string;
  titleIcon?: LucideIcon;
  titleIconClassName?: string;
  description?: string;
  actions?: React.ReactNode;
  actionsStart?: React.ReactNode;
  actionsEnd?: React.ReactNode;
  children: React.ReactNode;
  testId?: string;
  expandLabel: string;
  collapseLabel: string;
  expandSectionRef?: React.MutableRefObject<(() => void) | null>;
}

export function CollapsibleSection({
  sectionId,
  title,
  titleIcon: TitleIcon,
  titleIconClassName,
  description,
  actions,
  actionsStart,
  actionsEnd,
  children,
  testId,
  expandLabel,
  collapseLabel,
  expandSectionRef,
}: CollapsibleSectionProps) {
  const { expanded, toggleExpanded, setExpanded } = useSessionCollapsible(sectionId);

  useLayoutEffect(() => {
    if (!expandSectionRef) {
      return;
    }

    expandSectionRef.current = () => {
      setExpanded(true);
    };

    return () => {
      expandSectionRef.current = null;
    };
  }, [expandSectionRef, setExpanded]);

  const hasSplitActions = actionsStart != null || actionsEnd != null;
  const toggleLabel = expanded ? collapseLabel : expandLabel;

  const titleRow = (
    <div className={cn('flex', 'min-w-0', 'items-center', 'gap-x-2')}>
      {TitleIcon ? (
        <div
          className={cn('flex', 'items-center', 'justify-center', control.square.md, 'shrink-0')}
          aria-hidden="true"
        >
          <span className={cn(...controlIconWell.lg, titleIconClassName)}>
            <TitleIcon />
          </span>
        </div>
      ) : null}
      <h2 className={cn('min-w-0', uiTypographyRecipes.sectionTitle, uiTextRecipes.primary)}>
        {title}
      </h2>
    </div>
  );

  const headerShell = (content: React.ReactNode) => (
    <div className={cn(...uiInsightsPanelRecipes.summaryToggleShell)}>
      <button
        type="button"
        onClick={toggleExpanded}
        aria-label={toggleLabel}
        title={toggleLabel}
        aria-expanded={expanded}
        className={cn(...uiInsightsPanelRecipes.summaryToggleOverlay)}
      />
      <div
        className={cn(
          ...uiInsightsPanelRecipes.summaryToggleGrid,
          ...uiInsightsPanelRecipes.summaryToggleContent
        )}
      >
        <div
          className={cn(...uiInsightsPanelRecipes.summaryChevronColumnCenter)}
          aria-hidden="true"
        >
          <ChevronDown
            className={cn(...uiInsightsPanelRecipes.summaryChevron, expanded && 'rotate-180')}
          />
        </div>
        <div className={cn('min-w-0')}>{content}</div>
      </div>
    </div>
  );

  const splitActionsRow =
    actionsStart != null || actionsEnd != null ? (
      <div
        className={cn(
          'pointer-events-auto',
          'ml-auto',
          'flex',
          'shrink-0',
          'items-center',
          'gap-2'
        )}
      >
        {actionsStart != null ? <div className={cn('shrink-0')}>{actionsStart}</div> : null}
        {actionsEnd != null ? <div className={cn('shrink-0')}>{actionsEnd}</div> : null}
      </div>
    ) : null;

  return (
    <section className={cn('space-y-4')} data-testid={testId}>
      {hasSplitActions ? (
        <div className={cn('relative')}>
          {headerShell(
            <div className={cn('flex', 'min-w-0', 'flex-col', 'gap-1')}>
              <div className={cn('flex', 'min-w-0', 'items-center', 'gap-2')}>
                <div className={cn('min-w-0', 'flex-1')}>{titleRow}</div>
                {splitActionsRow}
              </div>
              {description ? (
                <p className={cn('min-w-0', uiTypographyRecipes.body, uiTextRecipes.muted)}>
                  {description}
                </p>
              ) : null}
            </div>
          )}
        </div>
      ) : (
        <div className={cn('relative')}>
          {headerShell(
            <div className={cn('flex', 'min-w-0', 'flex-col', 'gap-1')}>
              <div className={cn('flex', 'min-w-0', 'items-center', 'gap-2')}>
                <div className={cn('min-w-0', 'flex-1')}>{titleRow}</div>
                {actions ? (
                  <div className={cn('pointer-events-auto', 'ml-auto', 'shrink-0')}>{actions}</div>
                ) : null}
              </div>
              {description ? (
                <p className={cn('min-w-0', uiTypographyRecipes.body, uiTextRecipes.muted)}>
                  {description}
                </p>
              ) : null}
            </div>
          )}
        </div>
      )}
      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 0.61, 0.36, 1] }}
            className={cn('space-y-4', 'border-t', ...uiBorderRecipes.elevatedGlass, 'pt-4')}
          >
            {children}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
