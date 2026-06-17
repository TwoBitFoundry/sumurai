'use client';

import { Plus, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { DiyService } from '@/services/DiyService';
import { Button, cn, FormLabel, IconButton, Input, Modal, Select } from '@/ui/primitives';
import {
  border as uiBorderRecipes,
  surface as uiSurfaceRecipes,
  text as uiTextRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';

type DiyAccountDraft = {
  id: string;
  name: string;
  accountType: 'checking' | 'savings' | 'loan' | 'credit';
  mask: string;
  balance: string;
};

interface DiyInstitutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (connectionId: string) => Promise<void> | void;
  connectionId?: string | null;
  institutionName?: string | null;
}

const emptyAccountDraft = (): DiyAccountDraft => ({
  id: crypto.randomUUID(),
  name: '',
  accountType: 'checking',
  mask: '',
  balance: '',
});

export function DiyInstitutionModal({
  isOpen,
  onClose,
  onComplete,
  connectionId,
  institutionName,
}: DiyInstitutionModalProps) {
  const isExistingInstitution = Boolean(connectionId);
  const [step, setStep] = useState<'institution' | 'accounts'>(
    isExistingInstitution ? 'accounts' : 'institution'
  );
  const [institutionDraft, setInstitutionDraft] = useState(() => institutionName ?? '');
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(connectionId ?? null);
  const [accounts, setAccounts] = useState<DiyAccountDraft[]>(() => [emptyAccountDraft()]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setStep(connectionId ? 'accounts' : 'institution');
    setInstitutionDraft(institutionName ?? '');
    setActiveConnectionId(connectionId ?? null);
    setAccounts([emptyAccountDraft()]);
    setIsSubmitting(false);
    setError(null);
  }, [connectionId, institutionName, isOpen]);

  const title = useMemo(
    () => (step === 'institution' ? 'Create custom institution' : 'Add custom accounts'),
    [step]
  );

  const handleAddAccount = () => {
    setAccounts((current) => [...current, emptyAccountDraft()]);
  };

  const handleRemoveAccount = (index: number) => {
    setAccounts((current) => {
      if (current.length === 1) {
        return current;
      }
      return current.filter((_, currentIndex) => currentIndex !== index);
    });
  };

  const updateAccount = (
    index: number,
    field: keyof DiyAccountDraft,
    value: DiyAccountDraft[keyof DiyAccountDraft]
  ) => {
    setAccounts((current) =>
      current.map((account, currentIndex) =>
        currentIndex === index ? { ...account, [field]: value } : account
      )
    );
  };

  const submitInstitution = async () => {
    const trimmedName = institutionDraft.trim();
    if (!trimmedName) {
      setError('Enter an institution name.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const response = await DiyService.createInstitution(trimmedName);
      setActiveConnectionId(response.connection_id);
      setStep('accounts');
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to create institution');
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitAccounts = async () => {
    if (!activeConnectionId) {
      setError('Create the institution first.');
      return;
    }

    const hasInvalidAccount = accounts.some((account) => !account.name.trim());
    if (hasInvalidAccount) {
      setError('Enter a name for each account.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      for (const account of accounts) {
        await DiyService.createAccount(activeConnectionId, {
          name: account.name.trim(),
          account_type: account.accountType,
          mask: account.mask.trim() ? account.mask.trim() : null,
          balance: account.balance.trim() ? account.balance.trim() : null,
        });
      }
      await onComplete(activeConnectionId);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to save accounts');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      presentation="centered"
      size="lg"
      labelledBy="diy-institution-modal-title"
      description="diy-institution-modal-description"
      preventCloseOnBackdrop={isSubmitting}
    >
      <div className={cn('space-y-6', 'p-5', 'sm:p-6')}>
        <div className={cn('flex', 'items-start', 'justify-between', 'gap-4')}>
          <div className={cn('space-y-2')}>
            <p className={cn(uiTypographyRecipes.label, uiTextRecipes.subtle, 'uppercase')}>DIY</p>
            <h2
              id="diy-institution-modal-title"
              className={cn(uiTypographyRecipes.cardTitle, uiTextRecipes.primary)}
            >
              {title}
            </h2>
            <p
              id="diy-institution-modal-description"
              className={cn(uiTypographyRecipes.body, uiTextRecipes.body)}
            >
              {step === 'institution'
                ? 'Create a private institution, then add the accounts you want to track.'
                : 'Add one or more custom accounts under this institution.'}
            </p>
          </div>
          <IconButton
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Close DIY institution modal"
            onClick={onClose}
          >
            <X aria-hidden />
          </IconButton>
        </div>

        {error ? (
          <p className={cn(uiTypographyRecipes.caption, 'text-red-600', 'dark:text-red-400')}>
            {error}
          </p>
        ) : null}

        {step === 'institution' ? (
          <div className={cn('space-y-4')}>
            <div className={cn('space-y-2')}>
              <FormLabel htmlFor="diy-institution-name">Institution name</FormLabel>
              <Input
                id="diy-institution-name"
                value={institutionDraft}
                onChange={(event) => setInstitutionDraft(event.target.value)}
                placeholder="My credit union"
                autoComplete="off"
              />
            </div>
            <div className={cn('flex', 'justify-end', 'gap-3')}>
              <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void submitInstitution()}
                disabled={isSubmitting}
              >
                Continue
              </Button>
            </div>
          </div>
        ) : (
          <div className={cn('space-y-5')}>
            <div
              className={cn(
                'rounded-2xl',
                'border',
                ...uiBorderRecipes.subtle,
                ...uiSurfaceRecipes.insetWell,
                'p-4'
              )}
            >
              <p className={cn(uiTypographyRecipes.label, uiTextRecipes.subtle)}>Institution</p>
              <p className={cn(uiTypographyRecipes.bodyStrong, uiTextRecipes.primary)}>
                {institutionDraft.trim() || institutionName || 'Custom institution'}
              </p>
            </div>

            <div className={cn('space-y-4')}>
              {accounts.map((account, index) => (
                <div
                  key={account.id}
                  className={cn(
                    'space-y-4',
                    'rounded-2xl',
                    'border',
                    ...uiBorderRecipes.subtle,
                    ...uiSurfaceRecipes.card,
                    'p-4'
                  )}
                >
                  <div className={cn('flex', 'items-center', 'justify-between')}>
                    <p className={cn(uiTypographyRecipes.label, uiTextRecipes.subtle)}>
                      Account {index + 1}
                    </p>
                    {accounts.length > 1 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveAccount(index)}
                      >
                        Remove
                      </Button>
                    ) : null}
                  </div>

                  <div className={cn('grid', 'gap-4', 'md:grid-cols-2')}>
                    <div className={cn('space-y-2')}>
                      <FormLabel htmlFor={`diy-account-name-${index}`}>Account name</FormLabel>
                      <Input
                        id={`diy-account-name-${index}`}
                        value={account.name}
                        onChange={(event) => updateAccount(index, 'name', event.target.value)}
                        placeholder="Checking"
                        autoComplete="off"
                      />
                    </div>
                    <div className={cn('space-y-2')}>
                      <FormLabel htmlFor={`diy-account-type-${index}`}>Account type</FormLabel>
                      <Select
                        id={`diy-account-type-${index}`}
                        value={account.accountType}
                        onChange={(event) =>
                          updateAccount(
                            index,
                            'accountType',
                            event.target.value as DiyAccountDraft['accountType']
                          )
                        }
                      >
                        <option value="checking">Checking</option>
                        <option value="savings">Savings</option>
                        <option value="loan">Loan</option>
                        <option value="credit">Credit</option>
                      </Select>
                    </div>
                    <div className={cn('space-y-2')}>
                      <FormLabel htmlFor={`diy-account-mask-${index}`}>Mask</FormLabel>
                      <Input
                        id={`diy-account-mask-${index}`}
                        value={account.mask}
                        onChange={(event) => updateAccount(index, 'mask', event.target.value)}
                        placeholder="1234"
                        autoComplete="off"
                      />
                    </div>
                    <div className={cn('space-y-2')}>
                      <FormLabel htmlFor={`diy-account-balance-${index}`}>
                        Starting balance
                      </FormLabel>
                      <Input
                        id={`diy-account-balance-${index}`}
                        value={account.balance}
                        onChange={(event) => updateAccount(index, 'balance', event.target.value)}
                        placeholder="1000.00"
                        inputMode="decimal"
                        autoComplete="off"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className={cn('flex', 'flex-wrap', 'justify-between', 'gap-3')}>
              <Button type="button" variant="secondary" onClick={handleAddAccount}>
                <Plus aria-hidden />
                Add account
              </Button>
              <div className={cn('flex', 'gap-3')}>
                <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button type="button" onClick={() => void submitAccounts()} disabled={isSubmitting}>
                  Create institution
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default DiyInstitutionModal;
