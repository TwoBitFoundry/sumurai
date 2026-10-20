'use client';

import { FlaskConical, Loader2, Server } from 'lucide-react';
import { useState } from 'react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useScrollDetection } from '@/hooks/useScrollDetection';
import { HeroSubtitleInfo } from '@/layouts/HeroSubtitleInfo';
import { pageLayoutRecipes } from '@/layouts/PageLayout';
import { AuthService } from '@/services/authService';
import { Alert, AppTitleBar, Button, GradientShell } from '@/ui/primitives';
import { cn } from '@/ui/primitives/utils';
import { appLayout, control } from '@/ui/recipes';
import { OnboardingPathCard } from './OnboardingPathCard';

export interface OnboardingPathScreenProps {
  isDemoModeActive: boolean;
  onDemoActivated: () => void;
  onContinueToProviders: () => void;
  onLogout?: () => void;
}

export interface OnboardingPathScreenViewProps extends OnboardingPathScreenProps {
  onActivateDemo: () => Promise<unknown>;
}

const pathCardCtaButton = cn('w-auto', 'min-w-40');

const heroTitle = 'Choose your Sumurai path';
const heroSubtitle = 'Start with sample data or connect your own infrastructure.';

function OnboardingPathHero() {
  return (
    <section className={cn(...pageLayoutRecipes.shell)}>
      <div className={cn(pageLayoutRecipes.shellSurface)}>
        <div className={cn(pageLayoutRecipes.innerRing)} />
      </div>
      <div className={cn('relative', 'z-10', 'flex', 'flex-col', 'gap-5')}>
        <div className={cn('min-w-0', 'max-w-2xl', 'space-y-3')}>
          <div className={cn(...pageLayoutRecipes.titleInlineHost)}>
            <h1 className={cn(pageLayoutRecipes.titleInlineHeading)}>{heroTitle}</h1>{' '}
            <HeroSubtitleInfo pageTitle={heroTitle} subtitle={heroSubtitle} />
          </div>
        </div>
      </div>
    </section>
  );
}

export function OnboardingPathScreenView({
  isDemoModeActive,
  onActivateDemo,
  onDemoActivated,
  onContinueToProviders,
  onLogout,
}: OnboardingPathScreenViewProps) {
  const scrolled = useScrollDetection();
  const isOnline = useOnlineStatus();
  const [demoActivating, setDemoActivating] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);

  const activateDemo = async () => {
    setDemoActivating(true);
    setDemoError(null);
    try {
      await onActivateDemo();
      onDemoActivated();
    } catch {
      setDemoError('Demo mode could not be activated. Please try again.');
    } finally {
      setDemoActivating(false);
    }
  };

  return (
    <GradientShell>
      <div className={cn('flex', 'min-h-screen', 'flex-col')}>
        <AppTitleBar
          state="onboarding"
          scrolled={scrolled}
          isOnline={isOnline}
          onLogout={onLogout}
        />

        <main className={cn('flex', 'flex-1', 'items-start', 'pt-3', 'pb-8', 'md:pt-6', 'lg:pt-8')}>
          <div
            className={cn(
              ...appLayout.contentShellWithGutter,
              'flex',
              'min-w-0',
              'flex-col',
              'gap-6'
            )}
          >
            <OnboardingPathHero />

            {demoError ? (
              <Alert role="alert" variant="error" title="Demo mode unavailable">
                {demoError}
              </Alert>
            ) : null}

            <div
              className={cn(
                'grid',
                'grid-cols-1',
                'gap-6',
                'md:grid-cols-2',
                'lg:grid-cols-2',
                'md:gap-4'
              )}
            >
              <OnboardingPathCard
                meta="Explore at no cost"
                title="Demo mode"
                detail="See Sumurai in action with safe sample data. No financial account required."
                icon={FlaskConical}
                features={[
                  'Play around with demo data',
                  'Explore how all the features work first',
                  'Upgrade to connect real accounts',
                ]}
              >
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  className={pathCardCtaButton}
                  disabled={demoActivating}
                  onClick={() => void activateDemo()}
                >
                  {demoActivating ? (
                    <Loader2 aria-hidden className={cn(control.glyph.sm, 'animate-spin')} />
                  ) : null}
                  {isDemoModeActive ? 'Return to demo mode' : 'Try demo mode'}
                </Button>
              </OnboardingPathCard>

              <OnboardingPathCard
                meta="Free"
                title="Self Hosted"
                detail="Free, with your own data on your own infrastructure."
                icon={Server}
                features={[
                  'Choose your own financial providers with BYOK options',
                  'Fully control your deployment and data destiny',
                  'Always free core Sumurai experience',
                ]}
              >
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  className={pathCardCtaButton}
                  disabled={demoActivating}
                  onClick={onContinueToProviders}
                >
                  Continue
                </Button>
              </OnboardingPathCard>
            </div>
          </div>
        </main>
      </div>
    </GradientShell>
  );
}

export function OnboardingPathScreen(props: OnboardingPathScreenProps) {
  return (
    <OnboardingPathScreenView {...props} onActivateDemo={AuthService.activateDemoModeOnboarding} />
  );
}
