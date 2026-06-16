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

  const chevron = (
    <ChevronDown
      className={cn(
        'h-4',
        'w-4',
        'shrink-0',
        'transition-transform',
        'duration-200',
        expanded && 'rotate-180',
        'text-slate-500',
        'dark:text-slate-500'
      )}
    />
  );

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

  const chevronToggleButton = (className?: string) => (
    <button
      type="button"
      onClick={toggleExpanded}
      aria-hidden="true"
      tabIndex={-1}
      className={cn('cursor-pointer', 'pointer-events-auto', className)}
    >
      {chevron}
    </button>
  );

  return (
    <section className={cn('space-y-4')} data-testid={testId}>
      {hasSplitActions ? (
        <div className={cn('relative')}>
          <button
            type="button"
            onClick={toggleExpanded}
            aria-label={expanded ? collapseLabel : expandLabel}
            title={expanded ? collapseLabel : expandLabel}
            aria-expanded={expanded}
            className={cn('absolute', 'inset-0', 'z-0', 'cursor-pointer')}
          />
          <div className={cn('relative', 'z-10', 'pointer-events-none')}>
            <div className={cn('min-w-0')}>
              <div
                className={cn(
                  'flex',
                  'min-w-0',
                  'flex-wrap',
                  'items-center',
                  'gap-x-2',
                  'gap-y-2',
                  'lg:flex-nowrap'
                )}
              >
                <div className={cn('flex', 'min-w-0', 'w-full', 'flex-1', 'flex-col', 'lg:w-auto')}>
                  {titleRow}
                  {description ? (
                    <p
                      className={cn(
                        'mt-1',
                        'min-w-0',
                        uiTypographyRecipes.body,
                        uiTextRecipes.muted
                      )}
                    >
                      {description}
                    </p>
                  ) : null}
                </div>
                {actionsStart != null || actionsEnd != null ? (
                  <div
                    className={cn(
                      'relative',
                      'flex',
                      'w-full',
                      'items-center',
                      'justify-between',
                      'gap-2',
                      'lg:ml-auto',
                      'lg:w-auto',
                      'lg:justify-end'
                    )}
                  >
                    {actionsStart != null ? (
                      <div className={cn('relative', 'z-10', 'shrink-0', 'pointer-events-auto')}>
                        {actionsStart}
                      </div>
                    ) : null}
                    <div
                      className={cn('absolute', 'inset-x-0', 'flex', 'justify-center', 'lg:hidden')}
                    >
                      {chevronToggleButton(cn('flex', 'justify-center'))}
                    </div>
                    {actionsEnd != null ? (
                      <div className={cn('relative', 'z-10', 'shrink-0', 'pointer-events-auto')}>
                        {actionsEnd}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
            <div className={cn('mt-2', 'hidden', 'justify-center', 'pb-1', 'lg:flex')}>
              {chevronToggleButton(cn('flex', 'w-full', 'justify-center'))}
            </div>
          </div>
        </div>
      ) : (
        <div className={cn('relative')}>
          <button
            type="button"
            onClick={toggleExpanded}
            aria-label={expanded ? collapseLabel : expandLabel}
            title={expanded ? collapseLabel : expandLabel}
            aria-expanded={expanded}
            className={cn('w-full', 'text-left')}
          >
            {titleRow}
            {description ? (
              <p className={cn('mt-1', 'min-w-0', uiTypographyRecipes.body, uiTextRecipes.muted)}>
                {description}
              </p>
            ) : null}
            <div className={cn('flex', 'justify-center')}>{chevron}</div>
          </button>
          {actions ? (
            <div
              className={cn(
                'pointer-events-auto',
                'absolute',
                'right-0',
                'top-0',
                'z-10',
                'shrink-0'
              )}
            >
              {actions}
            </div>
          ) : null}
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
