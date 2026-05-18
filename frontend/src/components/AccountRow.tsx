import type React from 'react';
import { cn, GlassCard, RequirementPill } from '@/ui/primitives';
import {
  border as uiBorderRecipes,
  status as uiStatusRecipes,
  surface as uiSurfaceRecipes,
  text as uiTextRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';
import { accountTypeDot } from '@/ui/tokens';

interface Account {
  id: string;
  name: string;
  mask: string;
  type: 'checking' | 'savings' | 'credit' | 'loan' | 'other';
  balance?: number;
  transactions?: number;
}

interface AccountRowProps {
  account: Account;
}

const cardContainerClasses = cn(
  'group',
  'relative',
  'overflow-hidden',
  'transition-transform',
  'duration-200',
  'ease-out',
  'hover:-translate-y-[1px]'
);

const hoverOverlayClasses = cn(
  'pointer-events-none',
  'absolute',
  'inset-0',
  'rounded-[inherit]',
  'opacity-0',
  'transition-opacity',
  'duration-200',
  'ease-out',
  'bg-gradient-to-br',
  'from-sky-400/12',
  'via-transparent',
  'to-violet-500/14',
  'group-hover:opacity-100',
  'dark:from-sky-400/18',
  'dark:via-transparent',
  'dark:to-violet-500/18'
);

const accountMetaClasses = cn(
  'flex',
  'items-center',
  'gap-2',
  uiTypographyRecipes.captionStrong,
  'capitalize',
  uiTextRecipes.muted,
  'transition-colors',
  'duration-300',
  'ease-out'
);

const accountMaskClasses = cn(
  'font-mono',
  uiTextRecipes.subtle,
  'transition-colors',
  'duration-300',
  'ease-out'
);

const transactionsPillClasses = cn(
  'inline-flex',
  'items-center',
  'justify-center',
  'rounded-full',
  'border',
  'px-2.5',
  'py-1',
  uiTypographyRecipes.label,
  ...uiBorderRecipes.subtle,
  ...uiSurfaceRecipes.card,
  uiTextRecipes.muted,
  'transition-colors',
  'duration-300',
  'ease-out'
);

const formatMoney = (amount?: number) => {
  if (typeof amount !== 'number') return 'PLACEHOLDER';
  return amount.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
};

const AccountTypeDot: React.FC<{ type: Account['type'] }> = ({ type }) => {
  return (
    <span
      className={cn('inline-block', 'h-2.5', 'w-2.5', 'rounded-full')}
      style={{ backgroundColor: accountTypeDot[type] }}
    />
  );
};

export const AccountRow: React.FC<AccountRowProps> = ({ account }) => {
  const isDebtAccount = account.type === 'credit' || account.type === 'loan';
  const isOtherAccount = account.type === 'other';

  const rawBalance = account.balance;
  const balanceText = formatMoney(rawBalance);

  const balanceColor = cn(
    uiTypographyRecipes.bodyStrong,
    'tabular-nums',
    'transition-colors duration-300 ease-out',
    rawBalance == null && uiTextRecipes.subtle,
    rawBalance != null &&
      !isDebtAccount &&
      rawBalance > 0 &&
      !isOtherAccount &&
      uiStatusRecipes.success.text,
    rawBalance != null && !isDebtAccount && rawBalance > 0 && isOtherAccount && uiTextRecipes.muted,
    rawBalance != null && rawBalance < 0 && uiStatusRecipes.danger.text,
    isDebtAccount && rawBalance != null && uiStatusRecipes.danger.text,
    rawBalance === 0 && uiTextRecipes.subtle
  );

  return (
    <GlassCard
      variant="accent"
      rounded="lg"
      padding="none"
      withInnerEffects={false}
      containerClassName={cardContainerClasses}
    >
      <div className={cn('relative', 'p-6')}>
        <div className={hoverOverlayClasses} aria-hidden />
        <div className={cn('relative', 'z-10', 'space-y-3')}>
          <div className={cn('flex', 'items-center', 'justify-between')}>
            <div
              className={cn(
                uiTypographyRecipes.bodyStrong,
                uiTextRecipes.primary,
                'transition-colors',
                'duration-300',
                'ease-out'
              )}
            >
              {account.name}
            </div>
            <div className={balanceColor}>{balanceText}</div>
          </div>
          <div className={cn('flex', 'items-center', 'justify-between')}>
            <div className={accountMetaClasses}>
              <AccountTypeDot type={account.type} />
              <span>{account.type}</span>
              <span className={accountMaskClasses}>••{account.mask}</span>
            </div>
            <RequirementPill className={transactionsPillClasses} status="pending">
              {account.transactions ?? 0} items
            </RequirementPill>
          </div>
        </div>
      </div>
    </GlassCard>
  );
};
