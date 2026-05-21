import { Upload } from 'lucide-react';
import type React from 'react';
import type { CSSProperties } from 'react';
import { useState } from 'react';
import { ImportModal } from '@/features/import/components/ImportModal';
import { cn, GlassCard, IconButton, RequirementPill } from '@/ui/primitives';
import {
  dashboardCategoryCard,
  border as uiBorderRecipes,
  status as uiStatusRecipes,
  surface as uiSurfaceRecipes,
  text as uiTextRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';
import { useTheme } from '../context/ThemeContext';

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
  isOnline: boolean;
  onImportSuccess?: (count: number, mask: string) => void;
}

const cardContainerClasses = cn(
  'group',
  'relative',
  'overflow-hidden',
  ...dashboardCategoryCard.chartHoverBorder
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

export const AccountRow: React.FC<AccountRowProps> = ({ account, isOnline, onImportSuccess }) => {
  const [isImportOpen, setIsImportOpen] = useState(false);
  const { colors } = useTheme();
  const hoverBorderStyle = {
    '--dashboard-category-card-hover-border': colors.chart.primary[0],
  } as CSSProperties;
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
    <>
      <GlassCard
        variant="accent"
        rounded="lg"
        padding="none"
        withInnerEffects={false}
        containerClassName={cardContainerClasses}
        style={hoverBorderStyle}
      >
        <div className={cn('relative', 'p-6')}>
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
            <div className={cn('flex', 'items-center', 'justify-between', 'gap-3')}>
              <div className={accountMetaClasses}>
                <span className={accountMaskClasses}>••{account.mask}</span>
              </div>
              <div className={cn('flex', 'items-center', 'gap-2')}>
                <RequirementPill className={transactionsPillClasses} status="pending">
                  {account.transactions ?? 0} items
                </RequirementPill>
                <IconButton
                  type="button"
                  variant="ghost"
                  aria-label="Import transactions"
                  title="Import transactions"
                  disabled={!isOnline}
                  onClick={() => setIsImportOpen(true)}
                  className={cn(!isOnline && 'opacity-45')}
                >
                  <Upload />
                </IconButton>
              </div>
            </div>
          </div>
        </div>
      </GlassCard>
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
