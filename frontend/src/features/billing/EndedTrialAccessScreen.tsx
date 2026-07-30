'use client';

import { Crown, Download, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useScrollDetection } from '@/hooks/useScrollDetection';
import { pageLayoutRecipes } from '@/layouts/PageLayout';
import { AuthService } from '@/services/authService';
import { ExportService } from '@/services/ExportService';
import { SettingsService } from '@/services/SettingsService';
import type { BillingEnabledStatusResponse } from '@/types/api';
import { Alert, AppTitleBar, Button, GradientShell } from '@/ui/primitives';
import { cn } from '@/ui/primitives/utils';
import { appLayout, control } from '@/ui/recipes';
import { DeleteAccountModal } from '../settings/DeleteAccountModal';
import { PricingPlanCard } from './PricingPlanCard';
import { useBillingWorkflow } from './useBillingWorkflow';

interface EndedTrialAccessScreenProps {
  billingStatus: BillingEnabledStatusResponse;
  onLogout: () => void;
}

const workflowErrorCopy = {
  trial_already_used: 'This account has already used its free trial.',
  rate_limited: 'Too many attempts. Please wait and try again.',
  sdk: 'Checkout could not open. Please try again.',
  network: 'We could not reach billing. Check your connection and try again.',
  request: 'Billing could not complete the request. Please try again.',
} as const;

export function EndedTrialAccessScreen({ billingStatus, onLogout }: EndedTrialAccessScreenProps) {
  const workflow = useBillingWorkflow();
  const scrolled = useScrollDetection();
  const isOnline = useOnlineStatus();
  const [exportPending, setExportPending] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const workflowPending =
    workflow.status === 'creating' ||
    workflow.status === 'checkout_open' ||
    workflow.status === 'waiting_activation';
  const workflowError =
    workflow.status === 'error' && workflow.error
      ? workflowErrorCopy[workflow.error.kind]
      : workflow.status === 'timeout'
        ? 'Plan activation is taking longer than expected.'
        : null;
  const actionsPending = workflowPending || exportPending || deletePending;

  useEffect(() => {
    if (workflow.status === 'activated') {
      setExportError(null);
    }
  }, [workflow.status]);

  const startPremium = async () => {
    await workflow.startPremiumCheckout({
      token: billingStatus.paddle_client_token,
      environment: billingStatus.paddle_environment,
    });
  };

  const exportAccounts = async () => {
    setExportPending(true);
    setExportError(null);
    try {
      await ExportService.exportAccounts('csv');
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Account export failed.');
    } finally {
      setExportPending(false);
    }
  };

  const closeDelete = () => {
    if (deletePending) {
      return;
    }
    setDeleteOpen(false);
    setConfirmText('');
    setDeleteError(null);
  };

  const deleteAccount = async () => {
    if (confirmText !== 'DELETE' || deletePending) {
      return;
    }
    setDeletePending(true);
    setDeleteError(null);
    try {
      await SettingsService.deleteAccount();
      AuthService.clearToken();
      onLogout();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Failed to delete account');
      setDeletePending(false);
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
            <section className={cn(...pageLayoutRecipes.shell)}>
              <div className={cn(pageLayoutRecipes.shellSurface)}>
                <div className={cn(pageLayoutRecipes.innerRing)} />
              </div>
              <div className={cn('relative', 'z-10')}>
                <Alert role="alert" variant="warning" title="Your trial access has ended">
                  Upgrade to Premium to continue using Sumurai, export your account summary, or
                  delete your account. Demo mode and another trial are unavailable.
                </Alert>
              </div>
            </section>

            {workflowError || exportError ? (
              <Alert role="alert" variant="error" title="Action could not be completed">
                {workflowError ?? exportError}
              </Alert>
            ) : null}

            <div className={cn('mx-auto', 'grid', 'w-full', 'max-w-2xl', 'grid-cols-1')}>
              <PricingPlanCard
                meta="$8 per month"
                title="Premium"
                detail="Restore access to your connected financial data and planning workflows."
                icon={Crown}
                features={[
                  'Reconnect to your financial workspace',
                  'Continue Premium planning workflows',
                  'Secure managed billing',
                ]}
              >
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  disabled={actionsPending}
                  onClick={() => void startPremium()}
                >
                  {workflow.status === 'creating' ? (
                    <Loader2 aria-hidden className={cn(control.glyph.sm, 'animate-spin')} />
                  ) : null}
                  Upgrade to Premium
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  disabled={actionsPending}
                  onClick={() => void exportAccounts()}
                >
                  <Download aria-hidden className={cn(control.glyph.sm)} />
                  {exportPending ? 'Exporting…' : 'Export account summary'}
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  size="md"
                  disabled={actionsPending}
                  onClick={() => setDeleteOpen(true)}
                >
                  Delete account
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="md"
                  disabled={actionsPending}
                  onClick={onLogout}
                >
                  Log out
                </Button>
              </PricingPlanCard>
            </div>
          </div>
        </main>
      </div>

      <DeleteAccountModal
        isOpen={deleteOpen}
        isDeleting={deletePending}
        error={deleteError}
        confirmText={confirmText}
        onConfirmTextChange={setConfirmText}
        onConfirm={() => void deleteAccount()}
        onClose={closeDelete}
      />
    </GradientShell>
  );
}

export default EndedTrialAccessScreen;
