import { AnimatePresence, motion } from 'framer-motion';
import type React from 'react';
import { heroStatCardRecipes } from '@/components/widgets/HeroStatCard';
import { cn } from '@/ui/primitives';
import { type HeroAccent, heroAccents } from '@/ui/tokens';
import { BudgetInsightQuestion } from './BudgetInsightQuestion';

const FADE = { duration: 0.24, ease: [0.22, 0.61, 0.36, 1] } as const;

export const budgetInsightCardRecipes = {
  frontRow: 'flex w-full min-w-0 items-center justify-between gap-x-1.5 whitespace-nowrap',
  leading: 'flex min-w-0 items-center gap-x-1.5',
  metricCluster: 'flex min-w-0 shrink items-baseline justify-end gap-x-1.5',
  metric: 'inline-flex items-baseline gap-x-1.5 whitespace-nowrap',
  title: cn(heroStatCardRecipes.title, 'whitespace-nowrap'),
  value: cn(heroStatCardRecipes.value, 'whitespace-nowrap'),
  suffix: cn(heroStatCardRecipes.suffix, 'whitespace-nowrap'),
} as const;

export interface BudgetInsightCardProps {
  title: string;
  icon?: React.ReactNode;
  value: React.ReactNode;
  suffix?: React.ReactNode;
  question: string;
  accent?: HeroAccent;
  flipped: boolean;
  onToggle: () => void;
  className?: string;
}

export function BudgetInsightCard({
  title,
  icon,
  value,
  suffix,
  question,
  accent = 'sky',
  flipped,
  onToggle,
  className,
}: BudgetInsightCardProps) {
  const styles = heroAccents[accent];

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={flipped}
      aria-label={title}
      className={cn(heroStatCardRecipes.base, 'w-full text-left', className)}
      data-testid={`budget-insight-card-${title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div
        className={cn(
          heroStatCardRecipes.shellCompact,
          styles.border,
          styles.borderDark,
          styles.hoverBorder,
          styles.hoverBorderDark,
          'cursor-pointer'
        )}
      >
        <div
          className={cn(
            'hero-stat-card__gradient',
            'pointer-events-none',
            'absolute',
            'inset-0',
            'rounded-[length:inherit]',
            'opacity-0',
            'transition-opacity',
            'duration-300',
            'group-hover:opacity-100'
          )}
          style={{
            backgroundImage: `linear-gradient(135deg, ${styles.gradFrom}33, ${styles.gradVia}1f, transparent 70%)`,
          }}
        />
        <div className={cn(heroStatCardRecipes.ring)}>
          <div
            className={cn(heroStatCardRecipes.ringLine)}
            style={{ '--tw-ring-color': `${styles.ringHex}66` } as React.CSSProperties}
          />
        </div>

        <div className="relative z-10 w-full min-w-0">
          <AnimatePresence mode="wait" initial={false}>
            {flipped ? (
              <motion.div
                key="back"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={FADE}
              >
                <BudgetInsightQuestion question={question} />
              </motion.div>
            ) : (
              <motion.div
                key="front"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={FADE}
                className={cn(budgetInsightCardRecipes.frontRow)}
              >
                <div className={cn(budgetInsightCardRecipes.leading)}>
                  {icon ? (
                    <span className={cn(...heroStatCardRecipes.iconWell, styles.icon)}>{icon}</span>
                  ) : null}
                  <div className={cn(budgetInsightCardRecipes.title)}>{title}</div>
                </div>
                <div className={cn(budgetInsightCardRecipes.metricCluster)}>
                  <div className={cn(budgetInsightCardRecipes.value)}>{value}</div>
                  {suffix ? (
                    <div className={cn(budgetInsightCardRecipes.suffix)}>{suffix}</div>
                  ) : null}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </button>
  );
}
