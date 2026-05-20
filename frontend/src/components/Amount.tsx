import { text as uiTextRecipes } from '@/ui/recipes';
import { fmtUSD } from '../utils/format';

export { fmtUSD } from '../utils/format';

export function Amount({ value, className = '' }: { value: number; className?: string }) {
  const color =
    value < 0 ? uiTextRecipes.danger : value > 0 ? uiTextRecipes.success : uiTextRecipes.primary;
  return <span className={`${color} tabular-nums ${className}`}>{fmtUSD(value)}</span>;
}
