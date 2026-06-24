import { cn } from '@/ui/primitives';
import { categoryThemeVars } from '@/ui/tokens';
import { formatCategoryName, getTagThemeForCategory } from '@/utils/categories';

type CategoryInlinePillProps = {
  categoryKey: string;
  label?: string;
  accentIndexByName?: ReadonlyMap<string, number>;
  className?: string;
};

export function CategoryInlinePill({
  categoryKey,
  label,
  accentIndexByName,
  className,
}: CategoryInlinePillProps) {
  const displayLabel = label ?? formatCategoryName(categoryKey);
  const theme = getTagThemeForCategory(categoryKey, accentIndexByName);

  return (
    <span
      className={cn('min-w-0', 'max-w-full', 'truncate', theme.inlineLabel, className)}
      style={categoryThemeVars(theme)}
    >
      {displayLabel}
    </span>
  );
}

export default CategoryInlinePill;
