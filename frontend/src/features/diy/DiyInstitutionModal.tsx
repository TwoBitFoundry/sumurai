'use client';

import { Building2, Plus, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { DiyService } from '@/services/DiyService';
import {
  Button,
  cn,
  FormLabel,
  GlassCard,
  IconButton,
  Input,
  Modal,
  Select,
} from '@/ui/primitives';
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

type ExistingInstitutionAccount = {
  name: string;
  mask: string | null;
};

interface DiyInstitutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (connectionId: string) => Promise<void> | void;
  connectionId?: string | null;
  institutionName?: string | null;
  existingInstitutionNames?: string[];
  existingInstitutionAccounts?: ExistingInstitutionAccount[];
}

const normalizeInstitutionName = (name: string) => name.trim().toLocaleLowerCase();

const isInstitutionNameTaken = (name: string, existingNames: string[]) => {
  const normalized = normalizeInstitutionName(name);
  if (!normalized) {
    return false;
  }

  return existingNames.some(
    (existingName) => normalizeInstitutionName(existingName) === normalized
  );
};

const normalizeAccountName = (name: string) => name.trim().toLocaleLowerCase();

const normalizeAccountMask = (mask: string) => mask.trim();

const isAccountNameTakenAt = (
  name: string,
  draftIndex: number,
  drafts: DiyAccountDraft[],
  existingAccounts: ExistingInstitutionAccount[]
) => {
  const normalized = normalizeAccountName(name);
  if (!normalized) {
    return false;
  }

  const duplicateInDrafts = drafts.some(
    (draft, index) => index !== draftIndex && normalizeAccountName(draft.name) === normalized
  );
  const duplicateInExisting = existingAccounts.some(
    (account) => normalizeAccountName(account.name) === normalized
  );

  return duplicateInDrafts || duplicateInExisting;
};

const isAccountMaskTakenAt = (
  mask: string,
  draftIndex: number,
  drafts: DiyAccountDraft[],
  existingAccounts: ExistingInstitutionAccount[]
) => {
  const normalized = normalizeAccountMask(mask);
  if (!normalized) {
    return false;
  }

  const duplicateInDrafts = drafts.some(
    (draft, index) => index !== draftIndex && normalizeAccountMask(draft.mask) === normalized
  );
  const duplicateInExisting = existingAccounts.some((account) => {
    const existingMask = account.mask?.trim();
    return Boolean(existingMask) && existingMask === normalized;
  });

  return duplicateInDrafts || duplicateInExisting;
};

const getAccountFieldValidationError = (
  drafts: DiyAccountDraft[],
  existingAccounts: ExistingInstitutionAccount[]
) => {
  for (let index = 0; index < drafts.length; index += 1) {
    const account = drafts[index];
    if (isAccountNameTakenAt(account.name, index, drafts, existingAccounts)) {
      return 'Each account name must be unique within this institution.';
    }
    if (isAccountMaskTakenAt(account.mask, index, drafts, existingAccounts)) {
      return 'Each account mask must be unique within this institution.';
    }
  }

  return null;
};

const emptyAccountDraft = (): DiyAccountDraft => ({
  id: crypto.randomUUID(),
  name: '',
  accountType: 'checking',
  mask: '',
  balance: '',
});

const sanitizeBalanceInput = (value: string) => {
  const normalized = value.replace(/[^0-9.]/g, '');
  const [whole, ...fractionParts] = normalized.split('.');
  const fraction = fractionParts.join('');

  if (fractionParts.length === 0) {
    return whole;
  }

  return `${whole}.${fraction}`;
};

const getBalanceFieldError = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return 'Enter a balance.';
  }

  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    return 'Enter a valid balance.';
  }

  return null;
};

const isValidBalanceInput = (value: string) => getBalanceFieldError(value) === null;

const toBalancePayload = (value: string): string => value.trim();

export function DiyInstitutionModal({
  isOpen,
  onClose,
  onComplete,
  connectionId,
  institutionName,
  existingInstitutionNames = [],
  existingInstitutionAccounts = [],
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
    () => (step === 'institution' ? 'Add a custom institution' : 'Add custom accounts'),
    [step]
  );

  const trimmedInstitutionName = institutionDraft.trim();
  const institutionNameIsDuplicate = isInstitutionNameTaken(
    trimmedInstitutionName,
    existingInstitutionNames
  );
  const accountsHaveInvalidBalance = accounts.some(
    (account) => !isValidBalanceInput(account.balance)
  );
  const accountFieldValidationError = getAccountFieldValidationError(
    accounts,
    existingInstitutionAccounts
  );
  const accountsHaveDuplicateFields = accountFieldValidationError !== null;

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

  const handleBackToInstitution = () => {
    setError(null);
    setStep('institution');
  };

  const continueToAccounts = () => {
    const trimmedName = institutionDraft.trim();
    if (!trimmedName) {
      setError('Enter an institution name.');
      return;
    }

    if (isInstitutionNameTaken(trimmedName, existingInstitutionNames)) {
      setError('An institution with this name already exists.');
      return;
    }

    setError(null);
    setStep('accounts');
  };

  const submitAccounts = async () => {
    const trimmedName = institutionDraft.trim();
    const hasInvalidAccount = accounts.some((account) => !account.name.trim());
    if (hasInvalidAccount) {
      setError('Enter a name for each account.');
      return;
    }

    if (accountsHaveInvalidBalance) {
      setError('Enter a balance for each account.');
      return;
    }

    if (accountsHaveDuplicateFields) {
      setError(accountFieldValidationError);
      return;
    }

    if (!activeConnectionId) {
      if (!trimmedName) {
        setError('Enter an institution name.');
        return;
      }

      if (isInstitutionNameTaken(trimmedName, existingInstitutionNames)) {
        setError('An institution with this name already exists.');
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);
    try {
      let connectionIdForAccounts = activeConnectionId;

      if (!connectionIdForAccounts) {
        const response = await DiyService.createInstitution(trimmedName);
        connectionIdForAccounts = response.connection_id;
        setActiveConnectionId(connectionIdForAccounts);
      }

      for (const account of accounts) {
        await DiyService.createAccount(connectionIdForAccounts, {
          name: account.name.trim(),
          account_type: account.accountType,
          mask: account.mask.trim() ? account.mask.trim() : null,
          balance: toBalancePayload(account.balance),
        });
      }
      await onComplete(connectionIdForAccounts);
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
      <GlassCard
        variant="accent"
        rounded="xl"
        padding="none"
        withInnerEffects={false}
        className={cn('flex', 'max-h-[min(90dvh,48rem)]', 'min-h-0', 'flex-col', 'overflow-hidden')}
      >
        <div className={cn('flex', 'min-h-0', 'flex-1', 'flex-col', 'space-y-6', 'p-5', 'sm:p-6')}>
          <div className={cn('flex', 'items-start', 'justify-between', 'gap-4')}>
            <div className={cn('space-y-2')}>
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
                  ? 'A custom institution allows adding custom bank accounts to it.'
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
                  onChange={(event) => {
                    setInstitutionDraft(event.target.value);
                    if (error) {
                      setError(null);
                    }
                  }}
                  placeholder="My credit union"
                  autoComplete="off"
                  variant={institutionNameIsDuplicate ? 'invalid' : 'default'}
                  aria-invalid={institutionNameIsDuplicate}
                />
                {institutionNameIsDuplicate ? (
                  <p
                    className={cn(uiTypographyRecipes.caption, 'text-red-600', 'dark:text-red-400')}
                  >
                    An institution with this name already exists.
                  </p>
                ) : null}
              </div>
              <div className={cn('flex', 'justify-end')}>
                <Button
                  type="button"
                  onClick={continueToAccounts}
                  disabled={!trimmedInstitutionName || institutionNameIsDuplicate}
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

              <div
                className={cn(
                  'max-h-[min(45dvh,18rem)]',
                  'min-h-0',
                  'space-y-4',
                  'overflow-y-auto',
                  'pr-1'
                )}
              >
                {accounts.map((account, index) => {
                  const balanceFieldError = getBalanceFieldError(account.balance);
                  const balanceIsInvalid = balanceFieldError !== null;
                  const accountNameIsDuplicate = isAccountNameTakenAt(
                    account.name,
                    index,
                    accounts,
                    existingInstitutionAccounts
                  );
                  const accountMaskIsDuplicate = isAccountMaskTakenAt(
                    account.mask,
                    index,
                    accounts,
                    existingInstitutionAccounts
                  );

                  return (
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
                            variant={accountNameIsDuplicate ? 'invalid' : 'default'}
                            aria-invalid={accountNameIsDuplicate}
                          />
                          {accountNameIsDuplicate ? (
                            <p
                              className={cn(
                                uiTypographyRecipes.caption,
                                'text-red-600',
                                'dark:text-red-400'
                              )}
                            >
                              An account with this name already exists in this institution.
                            </p>
                          ) : null}
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
                            variant={accountMaskIsDuplicate ? 'invalid' : 'default'}
                            aria-invalid={accountMaskIsDuplicate}
                          />
                          {accountMaskIsDuplicate ? (
                            <p
                              className={cn(
                                uiTypographyRecipes.caption,
                                'text-red-600',
                                'dark:text-red-400'
                              )}
                            >
                              An account with this mask already exists in this institution.
                            </p>
                          ) : null}
                        </div>
                        <div className={cn('space-y-2')}>
                          <FormLabel htmlFor={`diy-account-balance-${index}`}>
                            Current balance
                          </FormLabel>
                          <Input
                            id={`diy-account-balance-${index}`}
                            value={account.balance}
                            onChange={(event) =>
                              updateAccount(
                                index,
                                'balance',
                                sanitizeBalanceInput(event.target.value)
                              )
                            }
                            placeholder="1000.00"
                            inputMode="decimal"
                            pattern="[0-9]*[.]?[0-9]*"
                            autoComplete="off"
                            variant={balanceIsInvalid ? 'invalid' : 'default'}
                            aria-invalid={balanceIsInvalid}
                          />
                          {balanceIsInvalid ? (
                            <p
                              className={cn(
                                uiTypographyRecipes.caption,
                                'text-red-600',
                                'dark:text-red-400'
                              )}
                            >
                              {balanceFieldError}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className={cn('flex', 'flex-wrap', 'justify-between', 'gap-3')}>
                <Button type="button" variant="secondary" onClick={handleAddAccount}>
                  <Plus aria-hidden />
                  Add account
                </Button>
                <div className={cn('flex', 'gap-3')}>
                  {!isExistingInstitution ? (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleBackToInstitution}
                      disabled={isSubmitting}
                    >
                      Back
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    onClick={() => void submitAccounts()}
                    disabled={
                      isSubmitting || accountsHaveInvalidBalance || accountsHaveDuplicateFields
                    }
                  >
                    <Building2 aria-hidden />
                    Create
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </GlassCard>
    </Modal>
  );
}

export default DiyInstitutionModal;
