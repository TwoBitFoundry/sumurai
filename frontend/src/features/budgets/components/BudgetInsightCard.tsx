import { AnimatePresence, motion } from 'framer-motion';
import type React from 'react';
import { heroStatCardRecipes } from '@/components/widgets/HeroStatCard';
import { cn } from '@/ui/primitives';
import { text as semanticTextRecipes, font as uiTypographyRecipes } from '@/ui/recipes';
import { type HeroAccent, heroAccents } from '@/ui/tokens';

const FADE = { duration: 0.24, ease: [0.22, 0.61, 0.36, 1] } as const;

export interface BudgetInsightCardProps {
  title: string;
  icon?: React.ReactNode;
  value: React.ReactNode;
  suffix?: React.ReactNode;
  subtext?: React.ReactNode;
  question: string;
  howToAct?: string;
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
  subtext,
  question,
  howToAct,
  accent = 'emerald',
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
          heroStatCardRecipes.shell,
          styles.border,
          styles.borderDark,
          styles.hoverBorder,
          styles.hoverBorderDark,
          'min-h-[120px]',
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

        <div className="relative z-10 flex h-full min-h-[88px] flex-col justify-between">
          <AnimatePresence mode="wait" initial={false}>
            {flipped ? (
              <motion.div
                key="back"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={FADE}
                className="flex h-full flex-col gap-2"
              >
                <p className={cn(uiTypographyRecipes.label, semanticTextRecipes.label)}>
                  {question}
                </p>
                {howToAct ? (
                  <p className={cn(uiTypographyRecipes.caption, semanticTextRecipes.muted)}>
                    {howToAct}
                  </p>
                ) : null}
              </motion.div>
            ) : (
              <motion.div
                key="front"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={FADE}
                className="flex h-full flex-col justify-between gap-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  {icon ? (
                    <span className={cn(...heroStatCardRecipes.iconWell, styles.icon)}>{icon}</span>
                  ) : null}
                  <div className={cn('min-w-0', heroStatCardRecipes.title)}>{title}</div>
                </div>
                <div className="flex flex-wrap items-baseline gap-2">
                  <div className={cn(heroStatCardRecipes.value)}>{value}</div>
                  {suffix ? <div className={cn(heroStatCardRecipes.suffix)}>{suffix}</div> : null}
                </div>
                {subtext ? (
                  <div className={cn(heroStatCardRecipes.footer)}>
                    <span
                      className={cn(
                        'inline-flex',
                        'max-w-none',
                        'flex-shrink-0',
                        'items-center',
                        'rounded-full',
                        'px-2',
                        'py-0.5',
                        uiTypographyRecipes.badge,
                        styles.defaultPill
                      )}
                    >
                      {subtext}
                    </span>
                  </div>
                ) : null}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </button>
  );
}
