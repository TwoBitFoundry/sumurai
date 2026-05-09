import { designTokens } from '@/ui/tokens';
import { fmtUSD } from '../utils/format';

export { fmtUSD } from '../utils/format';

export function Amount({ value, className = '' }: { value: number; className?: string }) {
  const isNegative = value < 0;
  const color = isNegative ? designTokens.text.danger : designTokens.text.primary;
  return <span className={`${color} tabular-nums ${className}`}>{fmtUSD(value)}</span>;
}
