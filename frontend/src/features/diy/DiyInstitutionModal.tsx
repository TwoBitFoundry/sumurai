'use client';

import { TrashIcon as TrashSolidIcon } from '@heroicons/react/24/solid';
import { Building2, CheckCircle2, ChevronLeft, Plus, Shield, Upload, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { DIY_ACCOUNT_TYPE_OPTIONS, type DiyAccountTypeValue } from '@/domain/accountCategories';
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
  control,
  border as uiBorderRecipes,
  effect as uiEffectRecipes,
  status as uiStatusRecipes,
  surface as uiSurfaceRecipes,
  text as uiTextRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';

const DIY_INSTITUTION_COPY = {
  title: 'Self-Managed',
  description: 'Manually add a bank and accounts, then import transactions from a supported file.',
  highlights: [
    {
      title: 'Strongest privacy option',
      body: 'No third party ever sees your data. Everything stays on your device.',
    },
    {
      title: 'You control your data',
      body: 'Import new bank data or remove the bank anytime to delete its accounts and transactions.',
    },
  ],
} as const;

type DiyAccountDraft = {
  id: string;
  name: string;
  accountType: DiyAccountTypeValue;
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
      return 'Each account name must be unique within this bank.';
    }
    if (isAccountMaskTakenAt(account.mask, index, drafts, existingAccounts)) {
      return 'Each account mask must be unique within this bank.';
    }
  }

  return null;
};

const emptyAccountDraft = (): DiyAccountDraft => ({
  id: crypto.randomUUID(),
  name: '',
  accountType: 'depository',
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

const connectBridgeDots = (
  <div className={cn('mx-2', 'flex', 'items-center', 'gap-1')}>
    <div className={cn('h-1', 'w-1', 'rounded-full', 'bg-slate-300', 'dark:bg-slate-600')} />
    <div className={cn('h-1', 'w-1', 'rounded-full', 'bg-slate-300', 'dark:bg-slate-600')} />
    <div className={cn('h-1', 'w-1', 'rounded-full', 'bg-slate-300', 'dark:bg-slate-600')} />
  </div>
);

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
    () => (step === 'institution' ? DIY_INSTITUTION_COPY.title : 'Add custom bank accounts'),
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
      setError('Enter a bank name.');
      return;
    }

    if (isInstitutionNameTaken(trimmedName, existingInstitutionNames)) {
      setError('A bank with this name already exists.');
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
        setError('Enter a bank name.');
        return;
      }

      if (isInstitutionNameTaken(trimmedName, existingInstitutionNames)) {
        setError('A bank with this name already exists.');
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
      labelledBy="diy-institution-modal-title"
      size="sm"
      animateCentered
      backdropVariant="provider"
      preventCloseOnBackdrop={isSubmitting}
    >
      <GlassCard
        variant="auth"
        padding="none"
        className={cn(
          'flex',
          'max-h-[min(90dvh,48rem)]',
          'min-h-0',
          'flex-col',
          'overflow-hidden',
          'space-y-6',
          'p-5',
          'md:p-6'
        )}
      >
        <div className={cn('flex', 'justify-end')}>
          <IconButton
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Close DIY bank modal"
            title="Close"
            onClick={onClose}
          >
            <X aria-hidden />
          </IconButton>
        </div>

        <div className={cn('flex', 'items-center', 'justify-center')}>
          <div
            className={cn(
              'rounded-2xl',
              'border',
              'bg-white',
              'p-3',
              ...uiEffectRecipes.glassDropShadow,
              ...uiBorderRecipes.default
            )}
          >
            <Upload className={cn('h-6', 'w-6', uiTextRecipes.subtle)} aria-hidden />
          </div>
          {connectBridgeDots}
          <div
            className={cn(
              'rounded-2xl',
              'border-2',
              'bg-white',
              'p-4',
              ...uiEffectRecipes.glassDropShadow,
              ...uiBorderRecipes.subtle
            )}
          >
            <Shield className={cn('h-10', 'w-10', ...uiStatusRecipes.info.icon)} aria-hidden />
          </div>
          {connectBridgeDots}
          <div
            className={cn(
              'rounded-2xl',
              'border',
              'bg-white',
              'p-3',
              ...uiEffectRecipes.glassDropShadow,
              ...uiBorderRecipes.default
            )}
          >
            <Building2 className={cn('h-6', 'w-6', uiTextRecipes.subtle)} aria-hidden />
          </div>
        </div>

        <div className={cn('space-y-2', 'text-center')}>
          <h2
            id="diy-institution-modal-title"
            className={cn(uiTypographyRecipes.cardTitle, uiTextRecipes.primary)}
          >
            {title}
          </h2>
          {step === 'institution' ? (
            <p className={cn(uiTypographyRecipes.body, uiTextRecipes.body)}>
              {DIY_INSTITUTION_COPY.description}
            </p>
          ) : null}
        </div>

        {step === 'institution' ? (
          <ul className={cn('space-y-3')}>
            {DIY_INSTITUTION_COPY.highlights.map((highlight) => (
              <li key={highlight.title} className={cn('flex', 'items-start', 'gap-3')}>
                <CheckCircle2
                  className={cn('mt-0.5', 'h-5', 'w-5', 'shrink-0', ...uiStatusRecipes.info.icon)}
                  aria-hidden
                />
                <div>
                  <p className={cn(uiTypographyRecipes.bodyStrong, uiTextRecipes.primary)}>
                    {highlight.title}
                  </p>
                  <p className={cn(uiTypographyRecipes.caption, uiTextRecipes.body)}>
                    {highlight.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        {error ? (
          <p
            className={cn(
              uiTypographyRecipes.caption,
              'text-center',
              'text-red-600',
              'dark:text-red-400'
            )}
          >
            {error}
          </p>
        ) : null}

        {step === 'institution' ? (
          <div className={cn('space-y-4')}>
            <div className={cn('space-y-3', 'text-center')}>
              <FormLabel htmlFor="diy-institution-name">Bank name</FormLabel>
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
                className={cn('text-center', 'placeholder:text-center')}
              />
              {institutionNameIsDuplicate ? (
                <p className={cn(uiTypographyRecipes.caption, 'text-red-600', 'dark:text-red-400')}>
                  A bank with this name already exists.
                </p>
              ) : null}
            </div>
            <Button
              type="button"
              variant="connect"
              size="md"
              className={cn('w-full')}
              onClick={continueToAccounts}
              disabled={!trimmedInstitutionName || institutionNameIsDuplicate}
            >
              Continue
            </Button>
          </div>
        ) : (
          <div className={cn('flex', 'min-h-0', 'flex-1', 'flex-col', 'gap-5')}>
            <div
              className={cn(
                'space-y-4',
                'rounded-2xl',
                'border',
                ...uiBorderRecipes.subtle,
                ...uiSurfaceRecipes.card,
                'p-4'
              )}
            >
              <div className={cn('grid', 'gap-4')}>
                <div className={cn('space-y-2')}>
                  <FormLabel htmlFor="diy-institution-name-readonly">Bank name</FormLabel>
                  <Input
                    id="diy-institution-name-readonly"
                    value={institutionDraft.trim() || institutionName || 'Custom bank'}
                    readOnly
                    aria-readonly="true"
                  />
                </div>
              </div>
            </div>

            <div className={cn('min-h-0', 'flex-1', 'space-y-4', 'overflow-y-auto', 'pr-1')}>
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
                    <div className={cn('grid', 'gap-4')}>
                      <div className={cn('space-y-2')}>
                        <div className={cn('flex', 'items-center', 'justify-between', 'gap-2')}>
                          <FormLabel htmlFor={`diy-account-name-${index}`}>Account name</FormLabel>
                          {accounts.length > 1 ? (
                            <IconButton
                              type="button"
                              variant="danger"
                              size="sm"
                              aria-label={`Remove account ${index + 1}`}
                              title="Remove account"
                              onClick={() => handleRemoveAccount(index)}
                            >
                              <TrashSolidIcon />
                            </IconButton>
                          ) : null}
                        </div>
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
                            An account with this name already exists in this bank.
                          </p>
                        ) : null}
                      </div>
                      <div className={cn('grid', 'grid-cols-2', 'gap-4')}>
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
                              An account with this mask already exists in this bank.
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
                            {DIY_ACCOUNT_TYPE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </Select>
                        </div>
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
              <div className={cn('flex', 'gap-1.5')}>
                {!isExistingInstitution ? (
                  <Button
                    type="button"
                    variant="secondary"
                    shape="square"
                    size="md"
                    aria-label="Back"
                    title="Back"
                    onClick={handleBackToInstitution}
                    disabled={isSubmitting}
                  >
                    <ChevronLeft className={cn(control.glyph.md)} aria-hidden />
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="secondary"
                  shape="square"
                  size="md"
                  aria-label="Add account"
                  title="Add account"
                  onClick={handleAddAccount}
                >
                  <Plus className={cn(control.glyph.md)} aria-hidden />
                </Button>
              </div>
              <Button
                type="button"
                variant="connect"
                size="md"
                onClick={() => void submitAccounts()}
                disabled={isSubmitting || accountsHaveInvalidBalance || accountsHaveDuplicateFields}
              >
                {isSubmitting ? 'Creating…' : 'Create'}
              </Button>
            </div>
          </div>
        )}
      </GlassCard>
    </Modal>
  );
}

export default DiyInstitutionModal;
