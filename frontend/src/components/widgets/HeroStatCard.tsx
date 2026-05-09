import React, { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/ui/primitives';
import { text as semanticTextRecipes, font as uiTypographyRecipes } from '@/ui/recipes';
import { getHeroAccentTheme, heroAccents } from '@/ui/tokens';
import { getTagThemeForCategory } from '../../utils/categories';
import { heroStatSemanticThemes } from './heroStatSemanticThemes';

type Accent = 'emerald' | 'sky' | 'violet' | 'amber' | 'slate' | 'rose';
type Tone = 'success' | 'info' | 'warning' | 'danger';

export type HeroPill = {
  label: string;
  type?: 'category' | 'semantic' | 'default';
  tone?: Tone;
  categoryName?: string;
};

export type HeroStatCardProps = {
  title: string;
  icon?: React.ReactNode;
  value: React.ReactNode;
  suffix?: React.ReactNode;
  subtext?: React.ReactNode;
  pills?: HeroPill[];
  index?: number;
  accent?: Accent;
  className?: string;
  minHeightClassName?: string;
};

export { heroStatSemanticThemes };

const heroFooterPillRecipes = {
  base: `inline-flex flex-shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 ${uiTypographyRecipes.badge}`,
  dot: 'h-2 w-2 rounded-full shadow-[0_0_0_1px_var(--color-border-glass)] dark:shadow-[0_0_0_1px_var(--color-effect-glass-shadow)]',
  fadeLeft:
    'pointer-events-none absolute bottom-0 left-0 top-0 w-6 bg-gradient-to-r from-[var(--color-surface-card)] to-transparent transition-opacity duration-200 dark:from-[var(--color-surface-card)]',
  fadeRight:
    'pointer-events-none absolute bottom-0 right-0 top-0 w-6 bg-gradient-to-l from-[var(--color-surface-card)] to-transparent transition-opacity duration-200 dark:from-[var(--color-surface-card)]',
} as const;

export const heroStatCardRecipes = {
  base: 'hero-stat-card group relative rounded-2xl transition-colors duration-300',
  shell:
    'relative h-full w-full overflow-hidden rounded-2xl border-2 bg-white/80 p-4 transform-gpu origin-center will-change-transform transition-transform duration-200 dark:bg-[#111a2f]/70',
  title: `${uiTypographyRecipes.label} ${semanticTextRecipes.label} transition-colors duration-500`,
  value: `${uiTypographyRecipes.cardTitle} ${semanticTextRecipes.primary} transition-colors duration-500`,
  suffix: `${uiTypographyRecipes.captionStrong} ${semanticTextRecipes.body} transition-colors duration-500`,
  overlay:
    'pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100',
  ring: 'pointer-events-none absolute inset-[2px] rounded-[calc(1rem-2px)] opacity-70',
  ringLine: 'absolute inset-0 rounded-[calc(1rem-2px)] ring-2',
  footer: 'relative',
  footerInner:
    'scrollbar-hide flex items-center gap-1.5 overflow-x-auto whitespace-nowrap [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
  semantic: heroStatSemanticThemes,
} as const;

function accentFromIndex(index?: number): Accent {
  if (!index || index < 1) return 'emerald';
  switch (index % 4) {
    case 1:
      return 'emerald';
    case 2:
      return 'sky';
    case 3:
      return 'violet';
    case 0:
      return 'amber';
    default:
      return 'emerald';
  }
}

export const HeroStatCard: React.FC<HeroStatCardProps> = ({
  title,
  icon,
  value,
  suffix,
  subtext,
  pills,
  index,
  accent: accentProp,
  className,
  minHeightClassName = 'min-h-[120px]',
}) => {
  const accent = accentProp ?? accentFromIndex(index);
  const styles = heroAccents[accent] ?? getHeroAccentTheme(accent);
  const pillsRef = useRef<HTMLDivElement>(null);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);

  const checkScroll = useCallback(() => {
    const el = pillsRef.current;
    if (!el) return;
    setShowLeftFade(el.scrollLeft > 0);
    setShowRightFade(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }, []);

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [checkScroll]);

  const hasFooter = Boolean(subtext) || Boolean(pills && pills.length > 0);
  const ringColorStyle = {
    '--tw-ring-color': `${styles.ringHex}66`,
  } as CSSProperties;

  return (
    <div className={cn(heroStatCardRecipes.base, className)}>
      <div
        className={cn(
          heroStatCardRecipes.shell,
          styles.border,
          styles.borderDark,
          styles.hoverBorder,
          styles.hoverBorderDark,
          'group-hover:-translate-y-[2px] group-hover:scale-[1.01]',
          minHeightClassName
        )}
      >
        <div
          className={cn(
            'hero-stat-card__gradient',
            'pointer-events-none',
            'absolute',
            'inset-0',
            'rounded-2xl',
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
          <div className={cn(heroStatCardRecipes.ringLine)} style={ringColorStyle} />
        </div>

        <div
          className={cn(
            'relative z-10 flex h-full flex-col gap-2',
            hasFooter ? 'justify-between' : 'justify-start'
          )}
        >
          <div className="flex items-center gap-2">
            {icon ? <span className={cn('h-4 w-4', styles.icon)}>{icon}</span> : null}
            <div className={cn(heroStatCardRecipes.title)}>{title}</div>
          </div>
          <div className="flex items-baseline gap-2">
            <div className={cn(heroStatCardRecipes.value)}>{value}</div>
            {suffix ? <div className={cn(heroStatCardRecipes.suffix)}>{suffix}</div> : null}
          </div>
          {subtext || (pills && pills.length > 0) ? (
            <div className="relative">
              <div
                ref={pillsRef}
                onScroll={checkScroll}
                className={cn(heroStatCardRecipes.footerInner)}
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {subtext ? (
                  <span className={cn(heroFooterPillRecipes.base, styles.defaultPill)}>
                    <span
                      className={cn(heroFooterPillRecipes.dot, styles.defaultDot)}
                      aria-hidden="true"
                    />
                    <span className="whitespace-nowrap">{subtext}</span>
                  </span>
                ) : null}

                {pills?.map((p, _idx) => {
                  if (p.type === 'category') {
                    const theme = getTagThemeForCategory(p.categoryName || p.label);
                    return (
                      <span
                        key={`${p.type}-${p.categoryName || p.label}`}
                        className={cn(heroFooterPillRecipes.base, theme.tag)}
                      >
                        <span
                          className={cn(heroFooterPillRecipes.dot, theme.dot)}
                          aria-hidden="true"
                        />
                        <span className="whitespace-nowrap">{p.label}</span>
                      </span>
                    );
                  }

                  let wrapperClass = styles.defaultPill;
                  let dotClass = styles.defaultDot;
                  if (p.type === 'semantic' && p.tone) {
                    const semantic = heroStatCardRecipes.semantic[p.tone];
                    wrapperClass = semantic.wrapper;
                    dotClass = semantic.dot;
                  }

                  return (
                    <span
                      key={`${p.type}-${p.label}`}
                      className={cn(heroFooterPillRecipes.base, wrapperClass)}
                    >
                      <span
                        className={cn(heroFooterPillRecipes.dot, dotClass)}
                        aria-hidden="true"
                      />
                      <span className="whitespace-nowrap">{p.label}</span>
                    </span>
                  );
                })}
              </div>
              {showLeftFade ? <div className={cn(heroFooterPillRecipes.fadeLeft)} /> : null}
              {showRightFade ? <div className={cn(heroFooterPillRecipes.fadeRight)} /> : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default HeroStatCard;
