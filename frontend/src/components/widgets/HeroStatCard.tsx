import React, { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/ui/primitives';
import { heroStatCard as heroStatCardRecipes, pill as pillRecipes } from '@/ui/primitives/recipes';
import { designTokens } from '@/ui/tokens';
import { getHeroAccentTheme, heroAccents } from '@/ui/tokens-runtime';
import { getTagThemeForCategory } from '../../utils/categories';

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

const classNames = (...classes: (string | false | null | undefined)[]) =>
  classes.filter(Boolean).join(' ');

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
    <div className={classNames(heroStatCardRecipes.base, className)}>
      <div
        className={classNames(
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
          className={classNames(
            'relative z-10 flex h-full flex-col gap-2',
            hasFooter ? 'justify-between' : 'justify-start'
          )}
        >
          <div className="flex items-center gap-2">
            {icon ? <span className={classNames('h-4 w-4', styles.icon)}>{icon}</span> : null}
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
                  <span className={classNames(pillRecipes.base, styles.defaultPill)}>
                    <span
                      className={classNames(pillRecipes.dot, styles.defaultDot)}
                      aria-hidden="true"
                    />
                    <span className="whitespace-nowrap">{subtext}</span>
                  </span>
                ) : null}

                {pills?.map((p, idx) => {
                  if (p.type === 'category') {
                    const theme = getTagThemeForCategory(p.categoryName || p.label);
                    return (
                      <span key={idx} className={classNames(pillRecipes.base, theme.tag)}>
                        <span
                          className={classNames(pillRecipes.dot, theme.dot)}
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
                    <span key={idx} className={classNames(pillRecipes.base, wrapperClass)}>
                      <span className={classNames(pillRecipes.dot, dotClass)} aria-hidden="true" />
                      <span className="whitespace-nowrap">{p.label}</span>
                    </span>
                  );
                })}
              </div>
              {showLeftFade ? <div className={cn(pillRecipes.fadeLeft)} /> : null}
              {showRightFade ? <div className={cn(pillRecipes.fadeRight)} /> : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default HeroStatCard;
