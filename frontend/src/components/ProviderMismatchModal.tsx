import { AlertTriangle } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { Badge, Button, GlassCard, Modal } from '@/ui/primitives';
import { cn } from '@/ui/primitives/utils';

interface ProviderMismatchModalProps {
  userProvider: string;
  defaultProvider: string;
  onConfirm: () => void;
}

export const ProviderMismatchModal = ({
  userProvider,
  defaultProvider,
  onConfirm,
}: ProviderMismatchModalProps) => {
  const buttonRef = useRef<HTMLButtonElement>(null);

  const providerLabels: Record<string, string> = {
    plaid: 'Plaid',
    teller: 'Teller',
  };

  const userProviderLabel = providerLabels[userProvider] || userProvider;
  const defaultProviderLabel = providerLabels[defaultProvider] || defaultProvider;

  useEffect(() => {
    buttonRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        buttonRef.current?.focus();
      }
    };

    const handleFocusOut = (e: FocusEvent) => {
      const nextTarget = e.relatedTarget as Node | null;
      if (!nextTarget) return;
      if (!buttonRef.current?.contains(nextTarget)) {
        buttonRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('focusout', handleFocusOut);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  return (
    <Modal
      isOpen
      preventCloseOnBackdrop
      onClose={onConfirm}
      labelledBy="provider-mismatch-title"
      size="sm"
    >
      <GlassCard
        variant="accent"
        rounded="xl"
        padding="lg"
        withInnerEffects={false}
        className={cn('space-y-6', 'text-center')}
      >
        <div className={cn('flex', 'justify-center')}>
          <span
            className={cn(
              'inline-flex',
              'rounded-full',
              'bg-amber-100',
              'p-3',
              'dark:bg-amber-900/30'
            )}
          >
            <AlertTriangle className={cn('h-8', 'w-8', 'text-amber-600', 'dark:text-amber-500')} />
          </span>
        </div>

        <div className="space-y-3">
          <h2
            id="provider-mismatch-title"
            className={cn('text-2xl', 'font-semibold', 'text-slate-900', 'dark:text-white')}
          >
            Provider configuration mismatch
          </h2>
          <p className={cn('text-sm', 'text-slate-600', 'dark:text-slate-300')}>
            Your account is configured to use
            <span className={cn('font-semibold', 'text-slate-900', 'dark:text-white')}>
              {' '}
              {userProviderLabel}{' '}
            </span>
            but the application default is
            <span className={cn('font-semibold', 'text-slate-900', 'dark:text-white')}>
              {' '}
              {defaultProviderLabel}
            </span>
            .
          </p>
          <p className={cn('text-sm', 'text-slate-600', 'dark:text-slate-300')}>
            Update your environment to set
            <Badge
              variant="feature"
              size="sm"
              className={cn('mx-1', 'font-mono', 'tracking-[0.2em]')}
            >
              DEFAULT_PROVIDER={userProvider}
            </Badge>
            and restart.
          </p>
        </div>

        <Button ref={buttonRef} variant="danger" size="lg" className="w-full" onClick={onConfirm}>
          Sign out
        </Button>
      </GlassCard>
    </Modal>
  );
};
