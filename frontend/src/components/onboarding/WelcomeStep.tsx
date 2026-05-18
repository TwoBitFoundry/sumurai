import type { LucideIcon } from 'lucide-react';
import { LayoutDashboard, ReceiptText, Target } from 'lucide-react';
import { Badge, cn } from '@/ui/primitives';
import {
  border as semanticBorders,
  effect as semanticEffects,
  surface as semanticSurfaces,
  status as uiStatusRecipes,
  text as uiTextRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';
import { featurePalettes } from '@/ui/tokens';

const dashboardHero = '/dashboard-hero.png';

type FeaturePalette = {
  gradient: string;
  ring: string;
  iconLight: string;
  iconDark: string;
  glow: string;
};

type WelcomeFeature = {
  icon: LucideIcon;
  title: string;
  copy: string;
  palette: FeaturePalette;
};

const onboardingStepCard = [
  'group relative overflow-hidden rounded-2xl p-4',
  ...semanticBorders.subtle,
  ...semanticSurfaces.card,
  ...semanticEffects.glassShadow,
  'transition-all duration-300 ease-out hover:-translate-y-[2px]',
  ...semanticEffects.accentHover,
] as const;

const onboardingIconWell = [
  'relative z-10 inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-full',
  ...semanticSurfaces.insetWell,
  'ring-1 ring-inset',
] as const;

const onboardingHoverOverlay =
  'pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-slate-200/60 via-slate-100/30 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 dark:from-slate-700/40 dark:via-slate-800/20';

const onboardingIconGlow =
  'absolute inset-[20%] rounded-full bg-[var(--color-effect-accent-hover)] opacity-20 blur-[6px] dark:bg-[var(--color-effect-accent-hover)] dark:opacity-[0.18]';

const onboardingTitleStrong = [
  'relative z-10 mt-3',
  uiTypographyRecipes.bodyStrong,
  'dark:text-white',
] as const;
const onboardingBodyMuted = [
  'relative z-10 mt-1',
  uiTypographyRecipes.caption,
  uiTextRecipes.body,
] as const;
const onboardingEyebrowCaps = [
  uiTypographyRecipes.label,
  'uppercase transition-colors duration-300 ease-out',
] as const;
const onboardingPreviewFrame = [
  'relative aspect-[16/10] overflow-hidden rounded-2xl',
  ...semanticBorders.subtle,
  'bg-[var(--color-surface-overlay)]',
  'shadow-lg md:aspect-[18/10]',
] as const;

const welcomeFeatures: WelcomeFeature[] = [
  {
    icon: LayoutDashboard,
    title: 'Dashboard',
    copy: 'Gain real insights into your finances, all in one place.',
    palette: featurePalettes.welcome.sky,
  },
  {
    icon: ReceiptText,
    title: 'Transactions',
    copy: 'Track your spending line by line by account.',
    palette: featurePalettes.welcome.amber,
  },
  {
    icon: Target,
    title: 'Budgets',
    copy: 'Set goals for your spending habits, and stick to them.',
    palette: featurePalettes.welcome.purple,
  },
];

function FeatureCard({ icon: Icon, title, copy, palette }: WelcomeFeature) {
  return (
    <div className={cn(onboardingStepCard)}>
      <div className={cn(onboardingHoverOverlay)} />
      <span
        className={cn(
          onboardingIconWell,
          palette.ring,
          palette.glow,
          'transition-all duration-200 ease-out group-hover:scale-105'
        )}
        aria-hidden="true"
      >
        <span className={cn('absolute inset-0 bg-gradient-to-br', palette.gradient)} />
        <span className={cn(onboardingIconGlow)} />
        <Icon
          className={cn('relative h-5 w-5', palette.iconLight, `dark:${palette.iconDark}`)}
          strokeWidth={1.7}
        />
      </span>
      <p className={cn(onboardingTitleStrong)}>{title}</p>
      <p className={cn(onboardingBodyMuted)}>{copy}</p>
    </div>
  );
}

export function WelcomeStep() {
  return (
    <div
      className={cn(
        'grid items-start gap-8',
        'lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]',
        'md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]'
      )}
    >
      <div className={cn('flex flex-col gap-8')}>
        <div className={cn('flex flex-col gap-5')}>
          <Badge
            variant="feature"
            size="sm"
            className={cn(
              'w-fit tracking-[0.3em]',
              ...uiStatusRecipes.info.surface,
              ...uiStatusRecipes.info.text
            )}
          >
            Welcome
          </Badge>

          <div className={cn('space-y-3')}>
            <h1
              className={cn(
                uiTypographyRecipes.pageTitle,
                uiTextRecipes.primary,
                'transition-colors',
                'duration-300',
                'ease-out'
              )}
            >
              Your new financial hub
            </h1>
            <p
              className={cn(
                uiTypographyRecipes.body,
                'leading-relaxed',
                uiTextRecipes.body,
                'transition-colors',
                'duration-300',
                'ease-out'
              )}
            >
              Bring every account into one secure place, watch budgets stay on track, and turn raw
              transactions into insights you can actually act on.
            </p>
          </div>
        </div>

        <div className={cn('flex flex-col gap-4')}>
          <div className={cn(onboardingEyebrowCaps)}>What you'll see</div>
          <div className={cn('grid gap-3 md:grid-cols-3')}>
            {welcomeFeatures.map((feature) => (
              <FeatureCard key={feature.title} {...feature} />
            ))}
          </div>
        </div>
      </div>

      <div className={cn('relative flex flex-col self-start')}>
        <div
          className={cn(
            'mb-3 mt-[52px] flex items-center justify-between md:mb-4',
            onboardingEyebrowCaps
          )}
        >
          <span>Live Dashboard Preview</span>
        </div>
        <div className={cn(onboardingPreviewFrame, 'transition-all duration-300 ease-out')}>
          <img
            src={dashboardHero}
            alt="Sumurai dashboard preview"
            className={cn('absolute inset-0 h-full w-full object-cover object-top')}
          />
        </div>
      </div>
    </div>
  );
}
