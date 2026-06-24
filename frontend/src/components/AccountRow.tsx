import { Upload } from 'lucide-react';
import { type CSSProperties, useRef, useState } from 'react';
import type { AccountCategoryType } from '@/domain/accountCategories';
import { ImportModal } from '@/features/import/components/ImportModal';
import { useTransactionListLauncher } from '@/features/transactions/hooks/useTransactionListLauncher';
import { cn, IconButton } from '@/ui/primitives';
import {
  dashboardCategoryCard,
  status as uiStatusRecipes,
  text as uiTextRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';
import { heroAccents } from '@/ui/tokens';

interface Account {
  id: string;
  name: string;
  mask: string;
  type: AccountCategoryType;
  balance?: number;
  transactions?: number;
}

interface AccountRowProps {
  account: Account;
  isOnline: boolean;
  onImportSuccess?: (count: number, mask: string) => void;
}

const cardContainerClasses = cn('group', 'relative', 'overflow-hidden');

const accountTriggerFocusRing = [
  'cursor-pointer',
  'focus-visible:outline-none',
  'focus-visible:ring-2',
  'focus-visible:ring-inset',
  'focus-visible:ring-[var(--color-border-focus-active)]',
] as const;

const accountHeroHoverRingStyle = {
  boxShadow: `inset 0 0 0 2px ${heroAccents.ocean.ringHex}`,
} as CSSProperties;

const accountMaskClasses = cn(
  uiTypographyRecipes.body,
  uiTextRecipes.subtle,
  'text-right',
  'transition-colors',
  'duration-500'
);

const transactionCountClasses = cn(
  uiTypographyRecipes.captionStrong,
  uiTextRecipes.muted,
  'tabular-nums',
  'text-right',
  'transition-colors',
  'duration-300',
  'ease-out'
);

const formatMoney = (amount?: number) => {
  if (typeof amount !== 'number') return 'PLACEHOLDER';
  return amount.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
};

export const AccountRow: React.FC<AccountRowProps> = ({ account, isOnline, onImportSuccess }) => {
  const [isImportOpen, setIsImportOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const { openTransactionList } = useTransactionListLauncher();
  const isCreditAccount = account.type === 'credit';
  const isLoanAccount = account.type === 'loan';
  const isInvestmentAccount = account.type === 'investments';

  const rawBalance = account.balance;
  const balanceText = formatMoney(rawBalance);

  const balanceColor = cn(
    uiTypographyRecipes.cardTitle,
    'tabular-nums',
    'transition-colors duration-300 ease-out',
    rawBalance == null && uiTextRecipes.subtle,
    rawBalance != null && account.type === 'cash' && rawBalance > 0 && uiStatusRecipes.success.text,
    rawBalance != null &&
      !isCreditAccount &&
      !isLoanAccount &&
      rawBalance > 0 &&
      isInvestmentAccount &&
      uiTextRecipes.muted,
    rawBalance != null && rawBalance < 0 && !isLoanAccount && uiStatusRecipes.danger.text,
    isCreditAccount && rawBalance != null && rawBalance !== 0 && uiStatusRecipes.danger.text,
    isLoanAccount && rawBalance != null && rawBalance !== 0 && 'text-[var(--color-brand-amber)]',
    rawBalance === 0 && uiTextRecipes.subtle
  );

  const handleOpen = () => {
    openTransactionList({ type: 'account', accountId: account.id }, cardRef);
  };

  return (
    <>
      {/* biome-ignore lint/a11y/useSemanticElements: nested import control requires a non-button shell */}
      <div
        ref={cardRef}
        className={cn(
          ...dashboardCategoryCard.shell,
          cardContainerClasses,
          ...accountTriggerFocusRing
        )}
        role="button"
        tabIndex={0}
        onClick={handleOpen}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleOpen();
          }
        }}
      >
        <div
          aria-hidden
          className={cn(...dashboardCategoryCard.insetRing)}
          style={accountHeroHoverRingStyle}
        />
        <div className={cn('relative z-10', 'flex', 'min-h-[6rem]', 'items-start', 'p-6')}>
          <div className={cn('relative', 'z-10', 'w-full', 'space-y-3')}>
            <div className={cn('flex', 'items-start', 'justify-between', 'gap-3')}>
              <div
                className={cn(
                  'min-w-0',
                  'flex-1',
                  'break-words',
                  uiTypographyRecipes.cardTitle,
                  uiTextRecipes.primary,
                  'transition-colors',
                  'duration-300',
                  'ease-out'
                )}
              >
                {account.name}
              </div>
              <div className={cn('shrink-0', 'text-right', balanceColor)}>{balanceText}</div>
            </div>
            <div className={cn('flex', 'items-center', 'justify-between', 'gap-3')}>
              <IconButton
                type="button"
                variant="ghost"
                aria-label="Import transactions"
                title="Import transactions"
                disabled={!isOnline}
                onClick={(event) => {
                  event.stopPropagation();
                  setIsImportOpen(true);
                }}
                className={cn('shrink-0', !isOnline && 'opacity-45')}
              >
                <Upload />
              </IconButton>
              <div className={cn('flex', 'flex-col', 'items-end', 'gap-0.5')}>
                <span className={accountMaskClasses}>••••{account.mask}</span>
                <span className={transactionCountClasses}>
                  {account.transactions ?? 0}
                  <span className={cn(uiTypographyRecipes.caption, uiTextRecipes.body, 'ml-0.5')}>
                    tx
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      {isImportOpen ? (
        <ImportModal
          account={account}
          isOpen={isImportOpen}
          onClose={() => setIsImportOpen(false)}
          onImportSuccess={onImportSuccess}
        />
      ) : null}
    </>
  );
};
