import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, type LucideIcon } from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { cn, IconButton } from '@/ui/primitives';
import { appTitleBarRecipes } from '@/ui/primitives/AppTitleBar';
import {
  control,
  controlIconWell,
  border as uiBorderRecipes,
  text as uiTextRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';
import {
  getSessionBudgetsSectionExpanded,
  setSessionBudgetsSectionExpanded,
} from '@/utils/sessionPreferences';

export interface CollapsibleSectionProps {
  sectionId: string;
  title: string;
  titleIcon?: LucideIcon;
  titleIconClassName?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  testId?: string;
  expandLabel: string;
  collapseLabel: string;
}

export function CollapsibleSection({
  sectionId,
  title,
  titleIcon: TitleIcon,
  titleIconClassName,
  description,
  actions,
  children,
  testId,
  expandLabel,
  collapseLabel,
}: CollapsibleSectionProps) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setExpanded(getSessionBudgetsSectionExpanded(sectionId));
  }, [sectionId]);

  const handleToggle = () => {
    setExpanded((value) => {
      const next = !value;
      setSessionBudgetsSectionExpanded(sectionId, next);
      return next;
    });
  };

  return (
    <section className={cn('space-y-4')} data-testid={testId}>
      <div
        className={cn(
          'flex',
          'flex-col',
          'gap-4',
          'sm:flex-row',
          'sm:items-start',
          'sm:justify-between'
        )}
      >
        <div
          className={cn(
            'grid',
            'min-w-0',
            'flex-1',
            'grid-cols-[auto_minmax(0,1fr)]',
            'items-center',
            'gap-x-2',
            'gap-y-1'
          )}
        >
          {TitleIcon ? (
            <div
              className={cn(
                'col-start-1',
                'row-start-1',
                'flex',
                'items-center',
                'justify-center',
                control.square.md,
                'shrink-0'
              )}
              aria-hidden="true"
            >
              <span className={cn(...controlIconWell.lg, titleIconClassName)}>
                <TitleIcon />
              </span>
            </div>
          ) : null}
          <h2
            className={cn(
              'col-start-2',
              'row-start-1',
              'min-w-0',
              uiTypographyRecipes.sectionTitle,
              uiTextRecipes.primary
            )}
          >
            {title}
          </h2>
          <IconButton
            type="button"
            size="md"
            onClick={handleToggle}
            variant="ghost"
            aria-label={expanded ? collapseLabel : expandLabel}
            aria-expanded={expanded}
            className={cn(
              appTitleBarRecipes.settingsIdle,
              'col-start-1',
              'row-start-2',
              'shrink-0',
              'justify-self-center'
            )}
          >
            <ChevronDown
              className={cn('transition-transform', 'duration-200', expanded && 'rotate-180')}
            />
          </IconButton>
          {description ? (
            <p
              className={cn(
                'col-start-2',
                'row-start-2',
                'min-w-0',
                uiTypographyRecipes.body,
                uiTextRecipes.muted
              )}
            >
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className={cn('shrink-0')}>{actions}</div> : null}
      </div>
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
