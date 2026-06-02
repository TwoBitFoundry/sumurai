import React, { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/ui/primitives';
import {
  controlIconWell,
  text as semanticTextRecipes,
  radius as uiRadiusRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';
import { getHeroAccentTheme, type HeroAccentTheme, heroAccents } from '@/ui/tokens';
import { useCategories } from '../../features/transactions/hooks/useCategories';
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
  footerScrollClassName?: string;
  layout?: 'stack' | 'row' | 'row-tablet';
};

export { heroStatSemanticThemes };

const heroFooterPillRecipes = {
  base: `inline-flex w-max max-w-none flex-shrink-0 flex-nowrap items-center gap-1.5 rounded-full px-2 py-0.5 ${uiTypographyRecipes.badge}`,
  label: 'whitespace-nowrap',
  fadeLeft:
    'pointer-events-none absolute bottom-0 left-0 top-0 w-6 bg-gradient-to-r from-[var(--color-surface-card)] to-transparent transition-opacity duration-200 dark:from-[var(--color-surface-card)]',
  fadeRight:
    'pointer-events-none absolute bottom-0 right-0 top-0 w-6 bg-gradient-to-l from-[var(--color-surface-card)] to-transparent transition-opacity duration-200 dark:from-[var(--color-surface-card)]',
} as const;

export const heroStatCardRecipes = {
  base: `hero-stat-card group relative min-w-0 ${uiRadiusRecipes.standard} transition-colors duration-300`,
  shell: `relative h-full w-full overflow-hidden ${uiRadiusRecipes.standard} border-2 bg-white/80 p-3 pt-4 transition-colors duration-200 lg:p-4 lg:pt-5 dark:bg-[#111a2f]/70`,
  title: `${uiTypographyRecipes.label} ${semanticTextRecipes.label} transition-colors duration-500`,
  value: `${uiTypographyRecipes.cardTitle} ${semanticTextRecipes.primary} transition-colors duration-500`,
  suffix: `${uiTypographyRecipes.captionStrong} ${semanticTextRecipes.body} transition-colors duration-500`,
  overlay: `pointer-events-none absolute inset-0 ${uiRadiusRecipes.standard} opacity-0 transition-opacity duration-300 group-hover:opacity-100`,
  ring: 'pointer-events-none absolute inset-[2px] rounded-[calc(var(--radius-standard)-2px)] opacity-70',
  ringLine: 'absolute inset-0 rounded-[calc(var(--radius-standard)-2px)] ring-2',
  footer: 'relative min-w-0 w-full max-w-full overflow-hidden',
  footerScroll:
    'scrollbar-hide flex w-full min-w-0 items-center gap-1.5 overflow-x-auto overflow-y-hidden whitespace-nowrap max-w-full [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
  iconWell: [...controlIconWell.lg, '[&_svg]:stroke-[2.25]'],
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

function HeroStatCardFooterPill({
  label,
  wrapperClass,
}: {
  label: React.ReactNode;
  wrapperClass: string;
}) {
  return (
    <span className={cn(heroFooterPillRecipes.base, wrapperClass)}>
      <span className={cn(heroFooterPillRecipes.label)}>{label}</span>
    </span>
  );
}

function HeroStatCardScrollFooter({
  subtext,
  pills,
  styles,
  className,
}: {
  subtext?: React.ReactNode;
  pills: HeroPill[];
  styles: HeroAccentTheme;
  className?: string;
}) {
  const { accentIndexByName } = useCategories();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setShowLeftFade(el.scrollLeft > 0);
    setShowRightFade(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }, []);

  useEffect(() => {
    checkScroll();

    const el = scrollRef.current;
    if (!el) {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      checkScroll();
    });
    resizeObserver.observe(el);

    window.addEventListener('resize', checkScroll);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', checkScroll);
    };
  }, [checkScroll]);

  return (
    <div className={cn(heroStatCardRecipes.footer)} data-testid="hero-stat-card-footer">
      <div
        ref={scrollRef}
        onScroll={checkScroll}
        className={cn(heroStatCardRecipes.footerScroll, className)}
        data-testid="hero-stat-card-footer-scroll"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {subtext ? (
          <HeroStatCardFooterPill label={subtext} wrapperClass={styles.defaultPill} />
        ) : null}
        {pills.map((pill) => {
          if (pill.type === 'category') {
            const theme = getTagThemeForCategory(
              pill.categoryName || pill.label,
              accentIndexByName
            );
            return (
              <HeroStatCardFooterPill
                key={`category-${pill.categoryName || pill.label}`}
                label={pill.label}
                wrapperClass={theme.tag}
              />
            );
          }

          let wrapperClass = styles.defaultPill;
          if (pill.type === 'semantic' && pill.tone) {
            const semantic = heroStatCardRecipes.semantic[pill.tone];
            wrapperClass = semantic.wrapper;
          }

          return (
            <HeroStatCardFooterPill
              key={`${pill.type ?? 'default'}-${pill.label}`}
              label={pill.label}
              wrapperClass={wrapperClass}
            />
          );
        })}
      </div>
      {showLeftFade ? <div className={cn(heroFooterPillRecipes.fadeLeft)} /> : null}
      {showRightFade ? <div className={cn(heroFooterPillRecipes.fadeRight)} /> : null}
    </div>
  );
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
  footerScrollClassName,
  layout = 'stack',
}) => {
  const accent = accentProp ?? accentFromIndex(index);
  const styles = heroAccents[accent] ?? getHeroAccentTheme(accent);
  const footerPills = pills?.length ? pills : [];
  const hasFooter = Boolean(subtext) || footerPills.length > 0;
  const ringColorStyle = {
    '--tw-ring-color': `${styles.ringHex}66`,
  } as CSSProperties;

  return (
    <div className={cn(heroStatCardRecipes.base, className)} data-testid="hero-stat-card">
      <div
        className={cn(
          heroStatCardRecipes.shell,
          styles.border,
          styles.borderDark,
          styles.hoverBorder,
          styles.hoverBorderDark,
          minHeightClassName
        )}
      >
        <div
          className={cn(
            'hero-stat-card__gradient',
            'pointer-events-none',
            'absolute',
            'inset-0',
            uiRadiusRecipes.standard,
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
            'relative z-10 flex h-full gap-2',
            layout === 'row'
              ? 'flex-row items-center justify-between lg:flex-col lg:items-start lg:justify-start'
              : layout === 'row-tablet'
                ? 'flex-col md:flex-row md:items-center md:justify-between lg:flex-col lg:items-start lg:justify-start'
                : cn('flex-col', hasFooter ? 'justify-between' : 'justify-start')
          )}
        >
          <div className="flex min-w-0 items-center gap-2">
            {icon ? (
              <span className={cn(...heroStatCardRecipes.iconWell, styles.icon)}>{icon}</span>
            ) : null}
            <div className={cn('min-w-0', heroStatCardRecipes.title)}>{title}</div>
          </div>
          <div className={cn('flex', 'flex-wrap', 'items-baseline', 'gap-2')}>
            <div className={cn(heroStatCardRecipes.value)}>{value}</div>
            {suffix ? <div className={cn(heroStatCardRecipes.suffix)}>{suffix}</div> : null}
          </div>
          {hasFooter ? (
            <HeroStatCardScrollFooter
              subtext={subtext}
              pills={footerPills}
              styles={styles}
              className={footerScrollClassName}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default HeroStatCard;
