import React from 'react'
import type { LucideIcon } from 'lucide-react'
import { LayoutDashboard, ReceiptText, Target } from 'lucide-react'
import dashboardHero from '@docs/images/dashboard-hero.png'
import { Badge, GlassCard, cn } from '@/ui/primitives'

type FeaturePalette = {
  gradient: string
  ring: string
  iconLight: string
  iconDark: string
  glow: string
}

type WelcomeFeature = {
  icon: LucideIcon
  title: string
  copy: string
  palette: FeaturePalette
}

const welcomeFeatures: WelcomeFeature[] = [
  {
    icon: LayoutDashboard,
    title: 'Dashboard',
    copy: 'Gain real insights into your finances, all in one place.',
    palette: {
      gradient: 'from-sky-400/55 via-sky-500/25 to-sky-500/5',
      ring: 'ring-sky-300/35',
      iconLight: 'text-sky-700',
      iconDark: 'text-sky-100',
      glow: 'shadow-[0_16px_42px_-25px_rgba(14,165,233,0.55)]',
    },
  },
  {
    icon: ReceiptText,
    title: 'Transactions',
    copy: 'Track your spending line by line by account.',
    palette: {
      gradient: 'from-amber-400/55 via-amber-500/25 to-amber-500/5',
      ring: 'ring-amber-300/35',
      iconLight: 'text-amber-700',
      iconDark: 'text-amber-100',
      glow: 'shadow-[0_16px_42px_-25px_rgba(245,158,11,0.55)]',
    },
  },
  {
    icon: Target,
    title: 'Budgets',
    copy: 'Set goals for your spending habits, and stick to them.',
    palette: {
      gradient: 'from-purple-400/55 via-purple-500/25 to-purple-500/5',
      ring: 'ring-purple-300/35',
      iconLight: 'text-purple-700',
      iconDark: 'text-purple-100',
      glow: 'shadow-[0_16px_42px_-25px_rgba(168,85,247,0.55)]',
    },
  },
]

function FeatureCard({ icon: Icon, title, copy, palette }: WelcomeFeature) {
  return (
    <GlassCard
      variant="accent"
      rounded="lg"
      padding="md"
      className={cn('flex h-full flex-col', 'items-center gap-3', 'text-center')}
    >
      <span
        className={cn(
          'relative inline-flex',
          'items-center justify-center',
          'overflow-hidden rounded-full',
          'h-11 w-11',
          'ring-1 ring-inset',
          'bg-slate-50',
          'dark:bg-slate-900',
          palette.ring,
          palette.glow
        )}
        aria-hidden="true"
      >
        <span className={cn('absolute inset-0', 'bg-gradient-to-br', palette.gradient)} />
        <span className={cn('absolute inset-[20%]', 'rounded-full bg-slate-300/30', 'opacity-40', 'blur-[6px]', 'dark:bg-black/20')} />
        <Icon className={cn('relative h-5 w-5', palette.iconLight, `dark:${palette.iconDark}`)} strokeWidth={1.7} />
      </span>
      <p className={cn('text-sm', 'font-semibold', 'text-slate-900', 'dark:text-white')}>{title}</p>
      <p className={cn('text-xs', 'text-slate-600', 'dark:text-slate-300')}>{copy}</p>
    </GlassCard>
  )
}

export function WelcomeStep() {
  return (
    <div className={cn('grid', 'items-start', 'gap-8', 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]', 'xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]')}>
      <div className={cn('flex', 'flex-col', 'gap-8')}>
        <div className={cn('flex', 'flex-col', 'gap-5')}>
          <Badge variant="primary" size="sm">
            Welcome
          </Badge>

          <div className={cn('flex', 'flex-col', 'gap-3')}>
            <h1 className={cn('text-3xl', 'font-bold', 'text-slate-900', 'dark:text-white', 'md:text-[2.6rem]')}>
              Your new financial hub
            </h1>
            <p className={cn('text-base', 'leading-relaxed', 'text-slate-600', 'dark:text-slate-300')}>
              Bring every account into one secure place, watch budgets stay on track, and turn raw transactions into insights you can actually act on.
            </p>
          </div>
        </div>

        <div className={cn('grid', 'gap-3', 'sm:grid-cols-3')}>
          {welcomeFeatures.map(feature => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </div>
      </div>

      <div className={cn('flex', 'flex-col', 'gap-3', 'lg:mt-[2.45rem]')}>
        <Badge variant="feature" size="sm" className={cn('self-start', 'tracking-[0.3em]', 'text-slate-600', 'dark:text-slate-300')}>
          Live Dashboard Preview
        </Badge>
        <GlassCard
          variant="default"
          rounded="lg"
          padding="none"
          withInnerEffects={false}
          containerClassName="aspect-[16/10] sm:aspect-[18/10]"
          className={cn('h-full', 'overflow-hidden')}
        >
          <img
            src={dashboardHero}
            alt="Sumaura dashboard preview"
            className={cn('h-full', 'w-full', 'object-cover', 'object-top')}
          />
        </GlassCard>
      </div>
    </div>
  )
}
