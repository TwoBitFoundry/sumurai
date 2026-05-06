import { AlertTriangle } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { Alert, Badge, Button, GlassCard, Modal } from '@/ui/primitives';
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
        className={cn('space-y-6')}
      >
        <Alert
          variant="warning"
          title="Provider configuration mismatch"
          icon={<AlertTriangle className={cn('h-5', 'w-5')} />}
          className={cn('flex-col', 'items-center', 'text-center')}
          id="provider-mismatch-title"
        >
          <div className="space-y-3">
            <p className={cn('text-sm')}>
              Your account is configured to use
              <span className={cn('font-semibold')}>
                {' '}
                {userProviderLabel}{' '}
              </span>
              but the application default is
              <span className={cn('font-semibold')}>
                {' '}
                {defaultProviderLabel}
              </span>
              .
            </p>
            <p className={cn('text-sm')}>
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
        </Alert>

        <Button ref={buttonRef} variant="danger" size="lg" className="w-full" onClick={onConfirm}>
          Sign out
        </Button>
      </GlassCard>
    </Modal>
  );
};
