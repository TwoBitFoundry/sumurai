import { cva, type VariantProps } from 'class-variance-authority';
import type React from 'react';
import {
  brandNeutral,
  control,
  text as semanticTextRecipes,
  radius as uiRadiusRecipes,
} from '@/ui/recipes';
import { cn } from './utils';

export const selectControl = {
  base: [
    'w-full',
    'border',
    'font-medium',
    'transition-all duration-200 ease-out',
    'focus:outline-none',
    'disabled:cursor-not-allowed disabled:opacity-60',
  ],
  default: [
    `bg-white ${semanticTextRecipes.primary}`,
    'border-black/10',
    'focus:ring-2 focus:ring-sky-400',
    'focus:ring-offset-2 focus:ring-offset-[var(--color-brand-fog)]',
    'dark:bg-[var(--color-brand-navy)]',
    'dark:border-white/12',
    'dark:focus:ring-sky-400/80',
    'dark:focus:ring-offset-[var(--color-brand-navy)]',
  ],
  invalid: [
    `bg-white ${semanticTextRecipes.primary}`,
    'border-red-300',
    'focus:ring-2 focus:ring-red-400',
    'focus:ring-offset-2 focus:ring-offset-[var(--color-brand-fog)]',
    'dark:bg-[var(--color-brand-navy)]',
    'dark:border-red-600/80',
    'dark:focus:ring-red-400/75',
    'dark:focus:ring-offset-[var(--color-brand-navy)]',
  ],
  glass: [
    `bg-white/80 ${brandNeutral.textBody}`,
    'border-white/60',
    'focus:ring-2 focus:ring-sky-400/80',
    'focus:ring-offset-2 focus:ring-offset-[var(--color-brand-fog)]',
    'dark:bg-[color:color-mix(in_srgb,var(--color-brand-navy)_80%,transparent)]',
    brandNeutral.controlTextDark,
    'dark:border-white/12',
    'dark:focus:ring-offset-[var(--color-brand-navy)]',
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
