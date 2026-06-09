import { AnimatePresence, motion } from 'framer-motion';
import type React from 'react';
import { heroStatCardRecipes } from '@/components/widgets/HeroStatCard';
import { cn } from '@/ui/primitives';
import { type HeroAccent, heroAccents } from '@/ui/tokens';
import { InsightQuestion } from './InsightQuestion';

const FADE = { duration: 0.24, ease: [0.22, 0.61, 0.36, 1] } as const;

export const insightCardRecipes = {
  frontRow: 'flex w-full min-w-0 items-center justify-between gap-x-1.5 whitespace-nowrap',
  tileRow: 'flex w-full min-w-0 flex-col gap-1.5 whitespace-normal',
  leading: 'flex min-w-0 flex-1 items-center gap-x-1.5',
  tileLeading: 'flex min-w-0 items-center gap-x-1.5',
  metricCluster: 'flex shrink-0 items-baseline justify-end gap-x-1.5',
  tileMetricCluster: 'flex min-w-0 shrink items-baseline justify-start gap-x-1.5',
  metric: 'inline-flex items-baseline gap-x-1.5 whitespace-nowrap',
  title: cn(heroStatCardRecipes.title, 'whitespace-nowrap'),
  tileTitle: cn(heroStatCardRecipes.title, 'whitespace-nowrap'),
  value: cn(
    heroStatCardRecipes.value,
    'grid grid-cols-[5rem_1.75rem_5.25rem] items-baseline gap-x-1 [&>*]:whitespace-nowrap'
  ),
  tileValue: cn(
    heroStatCardRecipes.value,
    'inline-flex items-baseline gap-x-1.5 [&>*]:whitespace-nowrap'
  ),
  suffix: cn(heroStatCardRecipes.suffix, 'whitespace-nowrap'),
} as const;

const SUBGRID_PASS = 'grid grid-cols-subgrid col-span-full';

export interface InsightCardProps {
  title: string;
  icon?: React.ReactNode;
  value: React.ReactNode;
  suffix?: React.ReactNode;
  question: string;
  accent?: HeroAccent;
  flipped: boolean;
  onToggle: () => void;
  outlined?: boolean;
  tileLayout?: boolean;
  subgridRow?: boolean;
  className?: string;
}

export function InsightCard({
  title,
  icon,
  value,
  suffix,
  question,
  accent = 'sky',
  flipped,
  onToggle,
  outlined = true,
  tileLayout = false,
  subgridRow = false,
  className,
}: InsightCardProps) {
  const styles = heroAccents[accent];
  let shellClassName: string;
  if (outlined) {
    shellClassName = cn(
      heroStatCardRecipes.shellCompact,
      styles.border,
      styles.borderDark,
      styles.hoverBorder,
      styles.hoverBorderDark,
      'cursor-pointer'
    );
  } else if (subgridRow) {
    shellClassName = 'contents';
  } else {
    shellClassName = cn(
      'relative',
      'w-full',
      'overflow-hidden',
      'rounded-[0.75rem]',
      'bg-transparent',
      'p-0',
      'transition-colors',
      'duration-200',
      'cursor-pointer',
      tileLayout && 'md:self-start'
    );
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={flipped}
      aria-label={title}
      className={cn(
        heroStatCardRecipes.base,
        'text-left',
        subgridRow ? 'contents' : 'w-full',
        tileLayout && 'md:flex-1 md:min-w-0',
        className
      )}
      data-testid={`insight-card-${title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div className={shellClassName}>
        {outlined ? (
          <>
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
          </>
        ) : null}

        <div className={cn(subgridRow ? 'contents' : 'relative z-10 w-full min-w-0')}>
          <AnimatePresence mode="wait" initial={false}>
            {flipped ? (
              <motion.div
                key="back"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={FADE}
                className={cn(subgridRow && 'col-span-full')}
              >
                <InsightQuestion question={question} />
              </motion.div>
            ) : subgridRow ? (
              <motion.div
                key="front"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={FADE}
                className={cn(SUBGRID_PASS, 'items-baseline gap-x-2', '[&>*]:whitespace-nowrap')}
              >
                {icon ? (
                  <span className={cn(...heroStatCardRecipes.iconWell, styles.icon, 'self-center')}>
                    {icon}
                  </span>
                ) : (
                  <span />
                )}
                <div className={cn(insightCardRecipes.title, 'self-center')}>{title}</div>
                {value}
              </motion.div>
            ) : (
              <motion.div
                key="front"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={FADE}
                className={cn(
                  tileLayout ? insightCardRecipes.tileRow : insightCardRecipes.frontRow
                )}
              >
                <div
                  className={cn(
                    tileLayout ? insightCardRecipes.tileLeading : insightCardRecipes.leading
                  )}
                >
                  {icon ? (
                    <span className={cn(...heroStatCardRecipes.iconWell, styles.icon)}>{icon}</span>
                  ) : null}
                  <div
                    className={cn(
                      tileLayout ? insightCardRecipes.tileTitle : insightCardRecipes.title
                    )}
                  >
                    {title}
                  </div>
                </div>
                <div
                  className={cn(
                    tileLayout
                      ? insightCardRecipes.tileMetricCluster
                      : insightCardRecipes.metricCluster
                  )}
                >
                  <div
                    className={cn(
                      tileLayout ? insightCardRecipes.tileValue : insightCardRecipes.value
                    )}
                  >
                    {value}
                  </div>
                  {suffix ? <div className={cn(insightCardRecipes.suffix)}>{suffix}</div> : null}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </button>
  );
}
