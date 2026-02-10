import React, { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/ui/primitives';
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
  /** Automatically selects accent by (index % 4): 1→emerald, 2→sky, 3→violet, 0→amber */
  index?: number;
  accent?: Accent;
  className?: string;
  /** Standardized min height for hero widgets */
  minHeightClassName?: string;
};

const classNames = (...classes: (string | false | null | undefined)[]) =>
  classes.filter(Boolean).join(' ');

const ACCENT_STYLES: Record<
  Accent,
  {
    border: string;
    borderDark: string;
    hoverBorder: string;
    hoverBorderDark: string;
    ringHex: string;
    gradFrom: string;
    gradVia: string;
    icon: string;
    defaultPill: string;
    defaultDot: string;
    glowRgb: string;
  }
> = {
  slate: {
    border: 'border-slate-300',
    borderDark: 'dark:border-slate-600',
    hoverBorder: 'hover:border-slate-400',
    hoverBorderDark: 'dark:hover:border-slate-500',
    ringHex: '#64748b',
    gradFrom: '#64748b',
    gradVia: '#475569',
    icon: 'text-slate-500 dark:text-slate-300',
    defaultPill:
      'border border-slate-200/70 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 bg-[linear-gradient(135deg,_rgba(226,232,240,0.95),_rgba(248,250,252,0.65))] dark:bg-[linear-gradient(135deg,_rgba(30,41,59,0.75),_rgba(15,23,42,0.6))] shadow-[0_16px_44px_-30px_rgba(15,23,42,0.55)] backdrop-blur-sm ring-1 ring-white/65 dark:ring-white/12',
    defaultDot: 'bg-slate-400/85 dark:bg-slate-200/80',
    glowRgb: '100,116,139',
  },
  emerald: {
    border: 'border-emerald-300',
    borderDark: 'dark:border-emerald-600',
    hoverBorder: 'hover:border-emerald-400',
    hoverBorderDark: 'dark:hover:border-emerald-500',
    ringHex: '#34d399',
    gradFrom: '#34d399',
    gradVia: '#10b981',
    icon: 'text-emerald-500 dark:text-emerald-400',
    defaultPill:
      'border border-emerald-200/70 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-200 bg-[linear-gradient(135deg,_rgba(16,185,129,0.22),_rgba(16,185,129,0.08))] dark:bg-[linear-gradient(135deg,_rgba(34,197,94,0.22),_rgba(34,197,94,0.08))] shadow-[0_18px_46px_-32px_rgba(16,185,129,0.55)] backdrop-blur-sm ring-1 ring-white/65 dark:ring-white/12',
    defaultDot: 'bg-emerald-500/90 dark:bg-emerald-300/80',
    glowRgb: '16,185,129',
  },
  sky: {
    border: 'border-sky-300',
    borderDark: 'dark:border-sky-600',
    hoverBorder: 'hover:border-sky-400',
    hoverBorderDark: 'dark:hover:border-sky-500',
    ringHex: '#93c5fd',
    gradFrom: '#38bdf8',
    gradVia: '#0ea5e9',
    icon: 'text-sky-500 dark:text-sky-400',
    defaultPill:
      'border border-sky-200/70 dark:border-sky-500/40 text-sky-700 dark:text-sky-200 bg-[linear-gradient(135deg,_rgba(14,165,233,0.2),_rgba(14,165,233,0.08))] dark:bg-[linear-gradient(135deg,_rgba(56,189,248,0.2),_rgba(56,189,248,0.08))] shadow-[0_18px_46px_-32px_rgba(14,165,233,0.55)] backdrop-blur-sm ring-1 ring-white/65 dark:ring-white/12',
    defaultDot: 'bg-sky-500/90 dark:bg-sky-300/80',
    glowRgb: '14,165,233',
  },
  violet: {
    border: 'border-violet-300',
    borderDark: 'dark:border-violet-600',
    hoverBorder: 'hover:border-violet-400',
    hoverBorderDark: 'dark:hover:border-violet-500',
    ringHex: '#a78bfa',
    gradFrom: '#a78bfa',
    gradVia: '#7c3aed',
    icon: 'text-violet-500 dark:text-violet-400',
    defaultPill:
      'border border-violet-200/70 dark:border-violet-500/40 text-violet-700 dark:text-violet-200 bg-[linear-gradient(135deg,_rgba(139,92,246,0.22),_rgba(139,92,246,0.08))] dark:bg-[linear-gradient(135deg,_rgba(167,139,250,0.22),_rgba(167,139,250,0.08))] shadow-[0_18px_46px_-32px_rgba(139,92,246,0.55)] backdrop-blur-sm ring-1 ring-white/65 dark:ring-white/12',
    defaultDot: 'bg-violet-500/90 dark:bg-violet-300/80',
    glowRgb: '167,139,250',
  },
  amber: {
    border: 'border-amber-300',
    borderDark: 'dark:border-amber-600',
    hoverBorder: 'hover:border-amber-400',
    hoverBorderDark: 'dark:hover:border-amber-500',
    ringHex: '#fbbf24',
    gradFrom: '#fbbf24',
    gradVia: '#f59e0b',
    icon: 'text-amber-500 dark:text-amber-400',
    defaultPill:
      'border border-amber-200/70 dark:border-amber-500/40 text-amber-700 dark:text-amber-200 bg-[linear-gradient(135deg,_rgba(245,158,11,0.22),_rgba(245,158,11,0.1))] dark:bg-[linear-gradient(135deg,_rgba(251,191,36,0.22),_rgba(251,191,36,0.08))] shadow-[0_18px_46px_-32px_rgba(245,158,11,0.52)] backdrop-blur-sm ring-1 ring-white/65 dark:ring-white/12',
    defaultDot: 'bg-amber-500/90 dark:bg-amber-300/85',
    glowRgb: '251,191,36',
  },
  rose: {
    border: 'border-rose-300',
    borderDark: 'dark:border-rose-600',
    hoverBorder: 'hover:border-rose-400',
    hoverBorderDark: 'dark:hover:border-rose-500',
    ringHex: '#f43f5e',
    gradFrom: '#fb7185',
    gradVia: '#f43f5e',
    icon: 'text-rose-500 dark:text-rose-400',
    defaultPill:
      'border border-rose-200/70 dark:border-rose-500/40 text-rose-700 dark:text-rose-200 bg-[linear-gradient(135deg,_rgba(244,63,94,0.22),_rgba(244,63,94,0.1))] dark:bg-[linear-gradient(135deg,_rgba(251,113,133,0.22),_rgba(251,113,133,0.08))] shadow-[0_18px_46px_-32px_rgba(244,63,94,0.5)] backdrop-blur-sm ring-1 ring-white/65 dark:ring-white/12',
    defaultDot: 'bg-rose-500/90 dark:bg-rose-300/80',
    glowRgb: '244,63,94',
  },
};

function accentFromIndex(index?: number): Accent {
  if (!index || index < 1) return 'emerald';
  const mod = index % 4;
  switch (mod) {
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

const SEMANTIC_PILLS: Record<Tone, { wrapper: string; dot: string }> = {
  success: {
    wrapper:
      'border border-emerald-200/70 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-200 bg-[linear-gradient(135deg,_rgba(16,185,129,0.24),_rgba(16,185,129,0.1))] dark:bg-[linear-gradient(135deg,_rgba(34,197,94,0.22),_rgba(34,197,94,0.08))] shadow-[0_14px_40px_-28px_rgba(16,185,129,0.52)] backdrop-blur-sm ring-1 ring-white/60 dark:ring-white/10',
    dot: 'bg-emerald-500/90 dark:bg-emerald-300/80',
  },
  info: {
    wrapper:
      'border border-sky-200/70 dark:border-sky-500/40 text-sky-700 dark:text-sky-200 bg-[linear-gradient(135deg,_rgba(14,165,233,0.22),_rgba(14,165,233,0.08))] dark:bg-[linear-gradient(135deg,_rgba(56,189,248,0.22),_rgba(56,189,248,0.08))] shadow-[0_14px_40px_-28px_rgba(14,165,233,0.52)] backdrop-blur-sm ring-1 ring-white/60 dark:ring-white/10',
    dot: 'bg-sky-500/90 dark:bg-sky-300/80',
  },
  warning: {
    wrapper:
      'border border-amber-200/70 dark:border-amber-500/40 text-amber-700 dark:text-amber-200 bg-[linear-gradient(135deg,_rgba(245,158,11,0.24),_rgba(245,158,11,0.1))] dark:bg-[linear-gradient(135deg,_rgba(251,191,36,0.22),_rgba(251,191,36,0.08))] shadow-[0_14px_40px_-28px_rgba(245,158,11,0.5)] backdrop-blur-sm ring-1 ring-white/60 dark:ring-white/10',
    dot: 'bg-amber-500/90 dark:bg-amber-300/85',
  },
  danger: {
    wrapper:
      'border border-rose-200/70 dark:border-rose-500/40 text-rose-700 dark:text-rose-200 bg-[linear-gradient(135deg,_rgba(244,63,94,0.24),_rgba(244,63,94,0.1))] dark:bg-[linear-gradient(135deg,_rgba(251,113,133,0.22),_rgba(251,113,133,0.08))] shadow-[0_14px_40px_-28px_rgba(244,63,94,0.48)] backdrop-blur-sm ring-1 ring-white/60 dark:ring-white/10',
    dot: 'bg-rose-500/90 dark:bg-rose-300/80',
  },
};

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
  const styles = ACCENT_STYLES[accent];

  // Pills fade/overflow handling
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
    <div
      className={classNames(
        'hero-stat-card group relative rounded-2xl transition-colors duration-300',
        className
      )}
    >
      <div
        className={classNames(
          'relative h-full w-full overflow-hidden rounded-2xl border-2 bg-white/80 p-4 transform-gpu origin-center will-change-transform transition-transform duration-200 dark:bg-[#111a2f]/70',
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
        <div
          className={cn(
            'pointer-events-none',
            'absolute',
            'inset-[2px]',
            'rounded-[calc(1rem-2px)]',
            'opacity-70'
          )}
        >
          <div
            className={cn('absolute', 'inset-0', 'rounded-[calc(1rem-2px)]', 'ring-2')}
            style={ringColorStyle}
          />
        </div>

        <div
          className={classNames(
            'relative z-10 flex h-full flex-col gap-2',
            hasFooter ? 'justify-between' : 'justify-start'
          )}
        >
          <div className={cn('flex', 'items-center', 'gap-2')}>
            {icon ? <span className={classNames('h-4 w-4', styles.icon)}>{icon}</span> : null}
            <div
              className={cn(
                'text-[0.65rem]',
                'font-semibold',
                'uppercase',
                'tracking-[0.24em]',
                'text-slate-500',
                'transition-colors',
                'duration-500',
                'dark:text-slate-400'
              )}
            >
              {title}
            </div>
          </div>
          <div className={cn('flex', 'items-baseline', 'gap-2')}>
            <div
              className={cn(
                'text-2xl',
                'font-semibold',
                'text-slate-900',
                'transition-colors',
                'duration-500',
                'dark:text-white'
              )}
            >
              {value}
            </div>
            {suffix ? (
              <div
                className={cn(
                  'text-sm',
                  'font-medium',
                  'text-slate-600',
                  'transition-colors',
                  'duration-500',
                  'dark:text-slate-300'
                )}
              >
                {suffix}
              </div>
            ) : null}
          </div>
          {subtext || (pills && pills.length > 0) ? (
            <div className="relative">
              <div
                ref={pillsRef}
                onScroll={checkScroll}
                className={cn(
                  'scrollbar-hide',
                  'flex',
                  'items-center',
                  'gap-1.5',
                  'overflow-x-auto',
                  'whitespace-nowrap',
                  '[-ms-overflow-style:none]',
                  '[scrollbar-width:none]',
                  '[&::-webkit-scrollbar]:hidden'
                )}
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {subtext ? (
                  <span
                    className={classNames(
                      'inline-flex flex-shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.18em]',
                      styles.defaultPill
                    )}
                  >
                    <span
                      className={classNames(
                        'h-2 w-2 flex-shrink-0 rounded-full shadow-[0_0_0_1px_rgba(255,255,255,0.85)] dark:shadow-[0_0_0_1px_rgba(15,23,42,0.7)]',
                        styles.defaultDot
                      )}
                      aria-hidden="true"
                    />
                    <span className="whitespace-nowrap">{subtext}</span>
                  </span>
                ) : null}

                {pills?.map((p, idx) => {
                  if (p.type === 'category') {
                    const theme = getTagThemeForCategory(p.categoryName || p.label);
                    return (
                      // biome-ignore lint/suspicious/noArrayIndexKey: pills are static for this view
                      <span
                        key={idx}
                        className={classNames(
                          'inline-flex flex-shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.18em]',
                          theme.tag
                        )}
                      >
                        <span
                          className={classNames(
                            'h-2 w-2 rounded-full shadow-[0_0_0_1px_rgba(255,255,255,0.85)] dark:shadow-[0_0_0_1px_rgba(15,23,42,0.7)]',
                            theme.dot
                          )}
                          aria-hidden="true"
                        />
                        <span className="whitespace-nowrap">{p.label}</span>
                      </span>
                    );
                  }

                  let wrapperClass = styles.defaultPill;
                  let dotClass = styles.defaultDot;
                  if (p.type === 'semantic' && p.tone) {
                    const semantic = SEMANTIC_PILLS[p.tone];
                    wrapperClass = semantic.wrapper;
                    dotClass = semantic.dot;
                  }

                  return (
                    // biome-ignore lint/suspicious/noArrayIndexKey: pills are static for this view
                    <span
                      key={idx}
                      className={classNames(
                        'inline-flex flex-shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.18em]',
                        wrapperClass
                      )}
                    >
                      <span
                        className={classNames(
                          'h-2 w-2 rounded-full shadow-[0_0_0_1px_rgba(255,255,255,0.85)] dark:shadow-[0_0_0_1px_rgba(15,23,42,0.7)]',
                          dotClass
                        )}
                        aria-hidden="true"
                      />
                      <span className="whitespace-nowrap">{p.label}</span>
                    </span>
                  );
                })}
              </div>
              {showLeftFade && (
                <div
                  className={cn(
                    'pointer-events-none',
                    'absolute',
                    'bottom-0',
                    'left-0',
                    'top-0',
                    'w-6',
                    'bg-gradient-to-r',
                    'from-white/80',
                    'to-transparent',
                    'transition-opacity',
                    'duration-200',
                    'dark:from-[#111a2f]/80'
                  )}
                />
              )}
              {showRightFade && (
                <div
                  className={cn(
                    'pointer-events-none',
                    'absolute',
                    'bottom-0',
                    'right-0',
                    'top-0',
                    'w-6',
                    'bg-gradient-to-l',
                    'from-white/80',
                    'to-transparent',
                    'transition-opacity',
                    'duration-200',
                    'dark:from-[#111a2f]/80'
                  )}
                />
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default HeroStatCard;
