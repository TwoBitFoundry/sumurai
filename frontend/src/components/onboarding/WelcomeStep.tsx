import type { LucideIcon } from 'lucide-react';
import { LayoutDashboard, ReceiptText, Target } from 'lucide-react';
import { onboardingTokenRecipes } from '@/components/onboarding/tokenRecipes';
import { Badge, cn } from '@/ui/primitives';
import { designTokens } from '@/ui/tokens';
import { featurePalettes } from '@/ui/tokens-runtime';

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
    <div className={cn(onboardingTokenRecipes.stepCard)}>
      <div className={cn(onboardingTokenRecipes.hoverOverlay)} />
      <span
        className={cn(
          onboardingTokenRecipes.iconWell,
          palette.ring,
          palette.glow,
          'transition-all duration-200 ease-out group-hover:scale-105'
        )}
        aria-hidden="true"
      >
        <span className={cn('absolute inset-0 bg-gradient-to-br', palette.gradient)} />
        <span className={cn(onboardingTokenRecipes.iconGlow)} />
        <Icon
          className={cn('relative h-5 w-5', palette.iconLight, `dark:${palette.iconDark}`)}
          strokeWidth={1.7}
        />
      </span>
      <p className={cn(onboardingTokenRecipes.titleStrong)}>{title}</p>
      <p className={cn(onboardingTokenRecipes.bodyMuted)}>{copy}</p>
    </div>
  );
}

export function WelcomeStep() {
  return (
    <div
      className={cn(
        'grid items-start gap-8',
        'lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]',
        'xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]'
      )}
    >
      <div className={cn('flex flex-col gap-8')}>
        <div className={cn('flex flex-col gap-5')}>
          <Badge
            variant="feature"
            size="sm"
            className={cn(
              'w-fit tracking-[0.3em]',
              ...designTokens.status.info.surface,
              ...designTokens.status.info.text
            )}
          >
            Welcome
          </Badge>

          <div className={cn('space-y-3')}>
            <h1
              className={cn(
                designTokens.typography.pageTitle,
                designTokens.text.primary,
                'transition-colors',
                'duration-300',
                'ease-out'
              )}
            >
              Your new financial hub
            </h1>
            <p
              className={cn(
                designTokens.typography.body,
                'leading-relaxed',
                designTokens.text.body,
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
          <div className={cn(onboardingTokenRecipes.eyebrowCaps)}>What you'll see</div>
          <div className={cn('grid gap-3 sm:grid-cols-3')}>
            {welcomeFeatures.map((feature) => (
              <FeatureCard key={feature.title} {...feature} />
            ))}
          </div>
        </div>
      </div>

      <div className={cn('relative flex flex-col self-start')}>
        <div
          className={cn(
            'mb-3 mt-[52px] flex items-center justify-between sm:mb-4',
            onboardingTokenRecipes.eyebrowCaps
          )}
        >
          <span>Live Dashboard Preview</span>
        </div>
        <div
          className={cn(
            onboardingTokenRecipes.previewFrame,
            'transition-all duration-300 ease-out'
          )}
        >
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
