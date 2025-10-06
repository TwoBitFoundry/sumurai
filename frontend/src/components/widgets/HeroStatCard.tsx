import React, { useEffect, useMemo, useRef, useState } from 'react'
import { getTagThemeForCategory } from '../../utils/categories'

type Accent = 'emerald' | 'sky' | 'violet' | 'amber'

type Tone = 'success' | 'info' | 'warning' | 'danger'

export type HeroPill = {
  label: string
  type?: 'category' | 'semantic' | 'default'
  tone?: Tone
  categoryName?: string
}

export type HeroStatCardProps = {
  title: string
  icon?: React.ReactNode
  value: React.ReactNode
  suffix?: React.ReactNode
  subtext?: React.ReactNode
  pills?: HeroPill[]
  /** Automatically selects accent by (index % 4): 1→emerald, 2→sky, 3→violet, 0→amber */
  index?: number
  accent?: Accent
  className?: string
  /** Standardized min height for hero widgets */
  minHeightClassName?: string
}

const classNames = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(' ')

const ACCENT_STYLES: Record<Accent, {
  border: string
  borderDark: string
  hoverBorder: string
  hoverBorderDark: string
  ringHex: string
  gradFrom: string
  gradVia: string
  icon: string
  defaultPill: string
  glowRgb: string
}> = {
  emerald: {
    border: 'border-emerald-300',
    borderDark: 'dark:border-emerald-600',
    hoverBorder: 'hover:border-emerald-400',
    hoverBorderDark: 'dark:hover:border-emerald-500',
    ringHex: '#34d399',
    gradFrom: '#34d399',
    gradVia: '#10b981',
    icon: 'text-emerald-500 dark:text-emerald-400',
    defaultPill: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
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
    defaultPill: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
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
    defaultPill: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
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
    defaultPill: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    glowRgb: '251,191,36',
  },
}

function accentFromIndex(index?: number): Accent {
  if (!index || index < 1) return 'emerald'
  const mod = index % 4
  switch (mod) {
    case 1: return 'emerald'
    case 2: return 'sky'
    case 3: return 'violet'
    case 0: return 'amber'
    default: return 'emerald'
  }
}

function semanticPillClass(tone: Tone): string {
  switch (tone) {
    case 'success':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
    case 'info':
      return 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300'
    case 'warning':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
    case 'danger':
      return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
    default:
      return ''
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
  minHeightClassName = 'min-h-[120px]'
}) => {
  const accent = accentProp ?? accentFromIndex(index)
  const styles = ACCENT_STYLES[accent]

  // Pills fade/overflow handling
  const pillsRef = useRef<HTMLDivElement>(null)
  const [showLeftFade, setShowLeftFade] = useState(false)
  const [showRightFade, setShowRightFade] = useState(false)

  const checkScroll = () => {
    const el = pillsRef.current
    if (!el) return
    setShowLeftFade(el.scrollLeft > 0)
    setShowRightFade(el.scrollLeft < el.scrollWidth - el.clientWidth - 1)
  }

  useEffect(() => {
    checkScroll()
    window.addEventListener('resize', checkScroll)
    return () => window.removeEventListener('resize', checkScroll)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pills?.length])

  const ringStyle = useMemo(() => ({
    // used by inline style to match existing ring tint
  }), [])

  const hasFooter = Boolean(subtext) || Boolean(pills && pills.length > 0)

  return (
    <div
      className={classNames(
        'hero-stat-card group relative rounded-2xl transition-colors duration-300',
        className,
      )}
    >
      <div className={classNames('relative h-full w-full overflow-hidden rounded-2xl border-2 bg-white/80 p-4 transform-gpu origin-center will-change-transform transition-transform duration-200 dark:bg-[#111a2f]/70', styles.border, styles.borderDark, styles.hoverBorder, styles.hoverBorderDark, 'group-hover:-translate-y-[2px] group-hover:scale-[1.01]', minHeightClassName)}>
        <div
          className="hero-stat-card__gradient pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{ backgroundImage: `linear-gradient(135deg, ${styles.gradFrom}33, ${styles.gradVia}1f, transparent 70%)` }}
        />
        <div className="pointer-events-none absolute inset-[2px] rounded-[calc(1rem-2px)] opacity-70">
          <div
            className="absolute inset-0 rounded-[calc(1rem-2px)] ring-2"
            style={{ ['--tw-ring-color' as any]: `${styles.ringHex}66` }}
          />
        </div>

        <div className={classNames('relative z-10 flex h-full flex-col gap-2', hasFooter ? 'justify-between' : 'justify-start')}>
          <div className="flex items-center gap-2">
            {icon ? <span className={classNames('h-4 w-4', styles.icon)}>{icon}</span> : null}
            <div className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-slate-500 transition-colors duration-500 dark:text-slate-400">{title}</div>
          </div>
          <div className="flex items-baseline gap-2">
            <div className="text-2xl font-semibold text-slate-900 transition-colors duration-500 dark:text-white">{value}</div>
            {suffix ? (
              <div className="text-sm font-medium text-slate-600 transition-colors duration-500 dark:text-slate-300">{suffix}</div>
            ) : null}
          </div>
          {(subtext || (pills && pills.length > 0)) ? (
            <div className="relative overflow-hidden">
              {subtext ? (
                <span className={classNames('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[0.6rem] font-medium', styles.defaultPill)}>
                  {subtext}
                </span>
              ) : null}
              {pills && pills.length > 0 ? (
                <>
                  <div
                    ref={pillsRef}
                    onScroll={checkScroll}
                    className="scrollbar-hide flex items-center gap-1.5 overflow-x-auto"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                  >
                    {pills.map((p, idx) => {
                      let pillClass = styles.defaultPill
                      if (p.type === 'semantic' && p.tone) pillClass = semanticPillClass(p.tone)
                      if (p.type === 'category') {
                        const theme = getTagThemeForCategory(p.categoryName || p.label)
                        pillClass = theme.tag
                      }
                      return (
                        <span
                          key={idx}
                          aria-hidden={p.type === 'category' ? true : undefined}
                          className={classNames('inline-flex flex-shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[0.6rem] font-medium', pillClass)}
                        >
                          {p.label}
                        </span>
                      )
                    })}
                  </div>
                  {showLeftFade && (
                    <div className="pointer-events-none absolute bottom-0 left-0 top-0 w-6 bg-gradient-to-r from-white/80 to-transparent transition-opacity duration-200 dark:from-[#111a2f]/80" />
                  )}
                  {showRightFade && (
                    <div className="pointer-events-none absolute bottom-0 right-0 top-0 w-6 bg-gradient-to-l from-white/80 to-transparent transition-opacity duration-200 dark:from-[#111a2f]/80" />
                  )}
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default HeroStatCard
