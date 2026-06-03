'use client';

import { Building2, CheckCircle2, Smartphone, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { SimpleFinTokenEntry } from '@/features/simplefin/components/SimpleFinTokenEntry';
import { useFinancialConnection } from '@/hooks/useFinancialConnection';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import type { FinancialProvider } from '@/types/api';
import { cn, GlassCard, IconButton, Modal } from '@/ui/primitives';
import {
  border as uiBorderRecipes,
  status as uiStatusRecipes,
  text as uiTextRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';
import { getConnectAccountProviderContent } from '@/utils/providerCards';

interface OnboardingProviderConnectModalProps {
  provider: FinancialProvider | null;
  isOpen: boolean;
  onClose: () => void;
  onConnected: (provider: FinancialProvider) => Promise<void> | void;
}

export function OnboardingProviderConnectModal({
  provider,
  isOpen,
  onClose,
  onConnected,
}: OnboardingProviderConnectModalProps) {
  if (!provider) {
    return null;
  }

  return (
    <OnboardingProviderConnectModalContent
      provider={provider}
      isOpen={isOpen}
      onClose={onClose}
      onConnected={onConnected}
    />
  );
}

function OnboardingProviderConnectModalContent({
  provider,
  isOpen,
  onClose,
  onConnected,
}: {
  provider: FinancialProvider;
  isOpen: boolean;
  onClose: () => void;
  onConnected: (provider: FinancialProvider) => Promise<void> | void;
}) {
  const isOnline = useOnlineStatus();
  const completedRef = useRef(false);
  const initiatedRef = useRef(false);
  const prevInProgressRef = useRef(false);

  const connectionFlow = useFinancialConnection({
    provider,
    isOnline,
  });
  const connectContent = getConnectAccountProviderContent(provider);
  const isSimpleFin = provider === 'simplefin';

  useEffect(() => {
    completedRef.current = false;
  }, []);

  useEffect(() => {
    if (initiatedRef.current || isSimpleFin) return;
    initiatedRef.current = true;
    const id = setTimeout(() => void connectionFlow.initiateConnection(), 0);
    return () => clearTimeout(id);
  }, [connectionFlow.initiateConnection, isSimpleFin]);

  useEffect(() => {
    if (isSimpleFin) return;
    const wasInProgress = prevInProgressRef.current;
    prevInProgressRef.current = connectionFlow.connectionInProgress;
    if (wasInProgress && !connectionFlow.connectionInProgress && !connectionFlow.isConnected) {
      onClose();
    }
  }, [connectionFlow.connectionInProgress, connectionFlow.isConnected, isSimpleFin, onClose]);

  useEffect(() => {
    if (completedRef.current) {
      return;
    }
    if (
      connectionFlow.isConnected &&
      !connectionFlow.connectionInProgress &&
      !connectionFlow.isSyncing
    ) {
      completedRef.current = true;
      void onConnected(provider);
    }
  }, [
    connectionFlow.connectionInProgress,
    connectionFlow.isConnected,
    connectionFlow.isSyncing,
    onConnected,
    provider,
  ]);

  if (!connectContent) {
    return null;
  }

  if (!isSimpleFin) {
    if (!isOpen) return null;
    return <div hidden>{connectionFlow.connectionMount}</div>;
  }

  return (
    <>
      <div hidden>{connectionFlow.connectionMount}</div>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        labelledBy={`${provider}-connect-modal-title`}
        description={`${provider}-connect-modal-description`}
        size="sm"
        animateCentered={isSimpleFin}
        backdropVariant="provider"
        preventCloseOnBackdrop={connectionFlow.connectionInProgress || connectionFlow.isSyncing}
      >
        <GlassCard variant="auth" padding="none" className={cn('space-y-6', 'p-5', 'sm:p-6')}>
          <div className={cn('flex', 'items-center', 'justify-between')}>
            <div className={cn('w-8')} />
            <span
              className={cn(
                'inline-flex',
                'items-center',
                'justify-center',
                'rounded-full',
                'px-4',
                'py-1',
                'uppercase',
                'tracking-[0.3em]',
                uiTypographyRecipes.label,
                connectContent.eyebrow.backgroundClassName,
                connectContent.eyebrow.textClassName
              )}
            >
              {connectContent.eyebrow.text}
            </span>
            <IconButton
              type="button"
              variant="ghost"
              size="sm"
              aria-label={`Close ${connectContent.displayName}`}
              onClick={onClose}
            >
              <X aria-hidden="true" />
            </IconButton>
          </div>

          <div className={cn('flex', 'items-center', 'justify-center')}>
            <div
              className={cn(
                'rounded-2xl',
                'border',
                'bg-white',
                'p-3',
                'shadow-sm',
                ...uiBorderRecipes.default
              )}
            >
              <Smartphone className={cn('h-6', 'w-6', uiTextRecipes.subtle)} aria-hidden="true" />
            </div>
            <div className={cn('mx-2', 'flex', 'items-center', 'gap-1')}>
              <div
                className={cn('h-1', 'w-1', 'rounded-full', 'bg-slate-300', 'dark:bg-slate-600')}
              />
              <div
                className={cn('h-1', 'w-1', 'rounded-full', 'bg-slate-300', 'dark:bg-slate-600')}
              />
              <div
                className={cn('h-1', 'w-1', 'rounded-full', 'bg-slate-300', 'dark:bg-slate-600')}
              />
            </div>
            <div
              className={cn(
                'rounded-2xl',
                'border-2',
                'bg-white',
                'p-4',
                'shadow-md',
                ...uiBorderRecipes.subtle
              )}
            >
              {connectContent.logoSrc ? (
                <img
                  src={connectContent.logoSrc}
                  alt={connectContent.displayName}
                  className={cn('h-10', 'w-10', 'object-contain')}
                />
              ) : (
                <Building2
                  className={cn('h-10', 'w-10', ...uiStatusRecipes.info.icon)}
                  aria-hidden="true"
                />
              )}
            </div>
            <div className={cn('mx-2', 'flex', 'items-center', 'gap-1')}>
              <div
                className={cn('h-1', 'w-1', 'rounded-full', 'bg-slate-300', 'dark:bg-slate-600')}
              />
              <div
                className={cn('h-1', 'w-1', 'rounded-full', 'bg-slate-300', 'dark:bg-slate-600')}
              />
              <div
                className={cn('h-1', 'w-1', 'rounded-full', 'bg-slate-300', 'dark:bg-slate-600')}
              />
            </div>
            <div
              className={cn(
                'rounded-2xl',
                'border',
                'bg-white',
                'p-3',
                'shadow-sm',
                ...uiBorderRecipes.default
              )}
            >
              <Building2 className={cn('h-6', 'w-6', uiTextRecipes.subtle)} aria-hidden="true" />
            </div>
          </div>

          <div className={cn('space-y-2', 'text-center')}>
            <h2
              id={`${provider}-connect-modal-title`}
              className={cn(uiTypographyRecipes.cardTitle, uiTextRecipes.primary)}
            >
              {connectContent.heroTitle}
            </h2>
            <p
              id={`${provider}-connect-modal-description`}
              className={cn(uiTypographyRecipes.body, uiTextRecipes.body)}
            >
              {connectContent.heroDescription}
            </p>
          </div>

          <ul className={cn('space-y-3')}>
            {connectContent.highlights.slice(0, 2).map((h) => (
              <li key={h.title} className={cn('flex', 'items-start', 'gap-3')}>
                <CheckCircle2
                  className={cn('mt-0.5', 'h-5', 'w-5', 'shrink-0', ...uiStatusRecipes.info.icon)}
                  aria-hidden="true"
                />
                <div>
                  <p className={cn(uiTypographyRecipes.bodyStrong, uiTextRecipes.primary)}>
                    {h.title}
                  </p>
                  <p className={cn(uiTypographyRecipes.caption, uiTextRecipes.body)}>{h.body}</p>
                </div>
              </li>
            ))}
          </ul>

          <SimpleFinTokenEntry
            showCard={false}
            showHeader={false}
            centered
            buttonLabel="Connect"
            isOnline={isOnline}
            isSubmitting={connectionFlow.connectionInProgress}
            error={connectionFlow.error}
            blockedReason={null}
            onSubmit={(setupToken) => connectionFlow.initiateConnection(setupToken)}
          />
        </GlassCard>
      </Modal>
    </>
  );
}

export default OnboardingProviderConnectModal;
