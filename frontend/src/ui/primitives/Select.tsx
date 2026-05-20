import { cva, type VariantProps } from 'class-variance-authority';
import type React from 'react';
import { control, radius as uiRadiusRecipes } from '@/ui/recipes';
import { cn } from './utils';

export const selectControl = {
  base: [
    'w-full',
    'border',
    'font-medium',
    'shadow-[0_18px_45px_-30px_rgba(15,23,42,0.45)]',
    'transition-all duration-200 ease-out',
    'focus:outline-none',
    'disabled:cursor-not-allowed disabled:opacity-60',
  ],
  default: [
    'bg-white text-slate-900 dark:text-slate-100',
    'border-black/10',
    'focus:ring-2 focus:ring-sky-400',
    'focus:ring-offset-2 focus:ring-offset-white',
    'dark:bg-[#111a2f]',
    'dark:border-white/12',
    'dark:focus:ring-sky-400/80',
    'dark:focus:ring-offset-[#0f172a]',
  ],
  invalid: [
    'bg-white text-slate-900 dark:text-slate-100',
    'border-red-300',
    'focus:ring-2 focus:ring-red-400',
    'focus:ring-offset-2 focus:ring-offset-white',
    'dark:bg-[#111a2f]',
    'dark:border-red-600/80',
    'dark:focus:ring-red-400/75',
    'dark:focus:ring-offset-[#0f172a]',
  ],
  glass: [
    'bg-white/80 text-slate-700 dark:text-slate-300',
    'border-white/60',
    'shadow-[0_18px_45px_-32px_rgba(15,23,42,0.5)]',
    'focus:ring-2 focus:ring-sky-400/80',
    'focus:ring-offset-2 focus:ring-offset-white',
    'dark:bg-[#111a2f]/80 dark:text-slate-100',
    'dark:border-white/12',
    'dark:focus:ring-offset-[#0f172a]',
  ],
} as const;

const selectVariants = cva([...selectControl.base], {
  variants: {
    variant: {
      default: [...selectControl.default],
      invalid: [...selectControl.invalid],
      glass: [...selectControl.glass],
    },
    selectSize: {
      sm: `${control.height.sm} ${control.paddingX.sm} ${control.label.sm} ${uiRadiusRecipes.standard}`,
      md: `${control.height.md} ${control.paddingX.md} ${control.label.md} ${uiRadiusRecipes.standard}`,
      lg: `${control.height.lg} ${control.paddingX.lg} ${control.label.lg} ${uiRadiusRecipes.standard}`,
    },
  },
  defaultVariants: {
    variant: 'default',
    selectSize: 'md',
  },
});

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'>,
    VariantProps<typeof selectVariants> {}

export const Select = ({
  variant,
  selectSize,
  className,
  ref,
  ...props
}: SelectProps & { ref?: React.RefObject<HTMLSelectElement | null> }) => {
  return (
    <select
      ref={ref}
      className={cn(selectVariants({ variant, selectSize }), className)}
      {...props}
    />
  );
};

Select.displayName = 'Select';

export default Select;
