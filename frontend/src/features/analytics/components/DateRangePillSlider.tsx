import { motion } from 'framer-motion';
import { appTitleBarRecipes } from '@/ui/primitives/AppTitleBar';
import { buttonRecipes } from '@/ui/primitives/Button';
import { cn } from '@/ui/primitives/utils';
import { text as uiTextRecipes, font as uiTypographyRecipes } from '@/ui/recipes';
import type { DateRangeKey as DateRange } from '@/utils/dateRanges';

const options: Array<{ key: DateRange; label: string }> = [
  { key: 'current-month', label: '1M' },
  { key: 'past-2-months', label: '2M' },
  { key: 'past-3-months', label: '3M' },
  { key: 'past-6-months', label: '6M' },
  { key: 'past-year', label: '1Y' },
  { key: 'all-time', label: '5Y' },
];

export function DateRangePillSlider({
  dateRange,
  onChange,
}: {
  dateRange: DateRange;
  onChange: (r: DateRange) => void;
}) {
  return (
    <div className={cn(...appTitleBarRecipes.pillContainer, 'min-w-0', 'max-w-full')}>
      {options.map((option) => {
        const isActive = option.key === dateRange;

        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onChange(option.key)}
            className={cn(
              ...appTitleBarRecipes.pillTab,
              'h-full flex-1 min-w-0',
              isActive ? buttonRecipes.tabActive : buttonRecipes.tab,
              isActive ? uiTextRecipes.inverse : uiTextRecipes.primary,
              uiTypographyRecipes.label
            )}
            aria-pressed={isActive}
          >
            {isActive ? (
              <motion.div
                layoutId="time-pill-active"
                className={cn('absolute inset-0 rounded-[length:inherit] bg-[inherit]')}
                transition={{ stiffness: 400, damping: 35 }}
              />
            ) : null}
            <span className={cn('relative z-10')}>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
