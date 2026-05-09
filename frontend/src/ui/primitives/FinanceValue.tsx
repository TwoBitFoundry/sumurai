import { useTheme } from '@/context/ThemeContext';
import { finance } from '@/ui/tokens';
import { cn } from './utils';

export type FinanceTone = 'cash' | 'investments' | 'credit' | 'loan' | 'netWorth';

export interface FinanceValueProps {
  tone: FinanceTone;
  value: number | string;
  format?: (value: number) => string;
  className?: string;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);

export function FinanceValue({ tone, value, format, className }: FinanceValueProps) {
  const { mode } = useTheme();
  const themeFinance = finance[mode];
  const displayValue = typeof value === 'number' ? (format ?? formatCurrency)(value) : value;

  return (
    <span
      className={cn('tabular-nums font-semibold', className)}
      style={{ color: themeFinance[tone] }}
    >
      {displayValue}
    </span>
  );
}

export default FinanceValue;
