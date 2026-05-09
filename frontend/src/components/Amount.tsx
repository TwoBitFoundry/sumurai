import { text as uiTextRecipes } from '@/ui/recipes';
import { fmtUSD } from '../utils/format';

export { fmtUSD } from '../utils/format';

export function Amount({ value, className = '' }: { value: number; className?: string }) {
  const isNegative = value < 0;
  const color = isNegative ? uiTextRecipes.danger : uiTextRecipes.primary;
  return <span className={`${color} tabular-nums ${className}`}>{fmtUSD(value)}</span>;
}
