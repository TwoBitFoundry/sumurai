import { ChevronLeft, ChevronRight } from 'lucide-react';
import type React from 'react';
import { cn } from '@/ui/primitives';
import type { MonthYearSelection } from '../utils/dateRanges';

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface MonthYearSelectorProps {
  value: MonthYearSelection;
  onChange: (value: MonthYearSelection) => void;
  visible?: boolean;
}

export const MonthYearSelector: React.FC<MonthYearSelectorProps> = ({
  value,
  onChange,
  visible = true,
}) => {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const availableMonths = value.year === currentYear ? months.slice(0, currentMonth + 1) : months;

  const isAllYear = value.month === null;
  const setMonth = (month: number) => onChange({ ...value, month });
  const toggleAllYear = () => {
    if (isAllYear) {
      const targetMonth = value.year === currentYear ? currentMonth : 0;
      onChange({ ...value, month: targetMonth });
    } else {
      onChange({ ...value, month: null });
    }
  };
  const setYear = (year: number) => {
    if (!Number.isFinite(year)) return;
    const nextYear = Math.min(Math.trunc(year), currentYear);
    const nextMonth =
      value.month === null
        ? null
        : nextYear === currentYear
          ? Math.min(value.month, currentMonth)
          : value.month;
    onChange({ year: nextYear, month: nextMonth });
  };

  return (
    <div
      className={cn(
        'fixed',
        'left-0',
        'right-0',
        'z-50',
        'flex',
        'justify-center',
        'px-4',
        'transition-opacity',
        'duration-300',
        'ease-out',
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      )}
      style={{ bottom: 24 }}
    >
      <div className={cn('flex', 'max-w-full', 'items-center', 'justify-center', 'gap-2')}>
        <div
          className={cn(
            'flex',
            'w-fit',
            'max-w-[calc(100vw-12rem)]',
            'sm:max-w-[42rem]',
            'gap-1.5',
            'overflow-x-auto',
            'rounded-2xl',
            'border',
            'border-slate-200/70',
            'bg-white/80',
            'px-3',
            'py-2',
            'shadow-xl',
            'backdrop-blur-md',
            'ring-1',
            'ring-slate-200/60',
            'dark:border-slate-700/70',
            'dark:bg-slate-800/80',
            'dark:ring-slate-700/60'
          )}
          aria-label="Select month"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {availableMonths.map((label, month) => {
            const selected = isAllYear || value.month === month;
            return (
              <button
                type="button"
                key={label}
                onClick={() => setMonth(month)}
                className={cn(
                  'h-8',
                  'min-w-12',
                  'whitespace-nowrap',
                  'rounded-lg',
                  'px-3',
                  'text-sm',
                  'font-medium',
                  'transition-all',
                  'duration-200',
                  selected
                    ? isAllYear
                      ? 'bg-primary-100/75 text-slate-900 shadow-sm dark:bg-slate-600/75 dark:text-slate-100'
                      : 'bg-primary-100 text-slate-900 shadow dark:bg-slate-600 dark:text-slate-100'
                    : 'text-slate-700 hover:-translate-y-[1px] hover:bg-white/60 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700/60 dark:hover:text-slate-100'
                )}
                aria-pressed={selected}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div
          className={cn(
            'flex',
            'flex-shrink-0',
            'h-12',
            'items-center',
            'gap-1',
            'rounded-2xl',
            'border',
            'border-slate-200/70',
            'bg-white/80',
            'px-2',
            'shadow-xl',
            'backdrop-blur-md',
            'ring-1',
            'ring-slate-200/60',
            'dark:border-slate-700/70',
            'dark:bg-slate-800/80',
            'dark:ring-slate-700/60'
          )}
          aria-label="Select year"
        >
          <button
            type="button"
            onClick={() => setYear(value.year - 1)}
            className={cn(
              'grid',
              'h-8',
              'w-8',
              'place-items-center',
              'rounded-lg',
              'text-slate-700',
              'transition-all',
              'duration-200',
              'hover:-translate-y-[1px]',
              'hover:bg-white/60',
              'hover:text-slate-900',
              'dark:text-slate-300',
              'dark:hover:bg-slate-700/60',
              'dark:hover:text-slate-100'
            )}
            aria-label="Previous year"
            title="Previous year"
          >
            <ChevronLeft className={cn('h-4', 'w-4')} />
          </button>
          <button
            type="button"
            onClick={toggleAllYear}
            className={cn(
              'grid',
              'h-8',
              'w-20',
              'place-items-center',
              'rounded-lg',
              'text-center',
              'text-sm',
              'font-semibold',
              'transition-all',
              'duration-200',
              'cursor-pointer',
              isAllYear
                ? 'bg-primary-100 text-slate-900 shadow dark:bg-slate-600 dark:text-slate-100 ring-2 ring-primary-500/40'
                : 'text-slate-700 hover:-translate-y-[1px] hover:bg-white/60 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700/60 dark:hover:text-slate-100'
            )}
            title={
              isAllYear
                ? 'Entire year selected — click to select single month'
                : 'Click to select entire year'
            }
            aria-pressed={isAllYear}
            aria-label={`Select entire year ${value.year}`}
          >
            {value.year}
          </button>
          <button
            type="button"
            onClick={() => setYear(value.year + 1)}
            disabled={value.year >= currentYear}
            className={cn(
              'grid',
              'h-8',
              'w-8',
              'place-items-center',
              'rounded-lg',
              'text-slate-700',
              'transition-all',
              'duration-200',
              'hover:-translate-y-[1px]',
              'hover:bg-white/60',
              'hover:text-slate-900',
              'disabled:pointer-events-none',
              'disabled:opacity-40',
              'dark:text-slate-300',
              'dark:hover:bg-slate-700/60',
              'dark:hover:text-slate-100'
            )}
            aria-label="Next year"
            title="Next year"
          >
            <ChevronRight className={cn('h-4', 'w-4')} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default MonthYearSelector;
