import { cva, type VariantProps } from 'class-variance-authority';
import type React from 'react';
import {
  control,
  floatingChromeSearch,
  border as semanticBorders,
  surface as semanticSurfaces,
  text as semanticTextRecipes,
  radius as uiRadiusRecipes,
} from '@/ui/recipes';
import { cn } from './utils';

export const inputControl = {
  base: [
    'w-full',
    'border',
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
    `bg-white/80 ${semanticTextRecipes.body}`,
    'border-white/60',
    'focus:ring-2 focus:ring-sky-400/80',
    'focus:ring-offset-2 focus:ring-offset-[var(--color-brand-fog)]',
    'dark:bg-[color:color-mix(in_srgb,var(--color-brand-navy)_80%,transparent)] dark:text-[color:color-mix(in_srgb,var(--color-brand-fog)_90%,var(--color-brand-navy))]',
    'dark:border-white/12',
    'dark:focus:ring-offset-[var(--color-brand-navy)]',
  ],
  floatingChrome: [
    ...semanticSurfaces.floatingChromePanel,
    ...semanticBorders.floatingChrome,
    semanticTextRecipes.primary,
    'focus-visible:outline-none',
    'focus-visible:ring-2',
    'focus-visible:ring-inset',
    'focus-visible:ring-[var(--color-border-focus-active)]',
  ],
  floatingChromeInvalid: [
    ...semanticSurfaces.floatingChromePanel,
    'border-[var(--color-status-danger-border)]',
    'dark:border-[var(--color-status-danger-border)]',
    semanticTextRecipes.primary,
    'focus-visible:outline-none',
    'focus-visible:ring-2',
    'focus-visible:ring-inset',
    'focus-visible:ring-[var(--color-status-danger-border)]',
  ],
  size: {
    sm: `${control.height.sm} ${control.paddingX.sm} ${control.label.sm} ${uiRadiusRecipes.standard}`,
    md: `${control.height.md} ${control.paddingX.md} ${control.label.md} ${uiRadiusRecipes.standard}`,
    lg: `${control.height.lg} ${control.paddingX.lg} ${control.label.lg} ${uiRadiusRecipes.standard}`,
    chromeBar: `${floatingChromeSearch.height} ${floatingChromeSearch.paddingX} ${floatingChromeSearch.label} ${uiRadiusRecipes.standard}`,
  },
} as const;

const inputVariants = cva([...inputControl.base], {
  variants: {
    variant: {
      default: [...inputControl.default],
      invalid: [...inputControl.invalid],
      glass: [...inputControl.glass],
      floatingChrome: [...inputControl.floatingChrome],
      floatingChromeInvalid: [...inputControl.floatingChromeInvalid],
    },
    inputSize: {
      sm: inputControl.size.sm,
      md: inputControl.size.md,
      lg: inputControl.size.lg,
      chromeBar: inputControl.size.chromeBar,
    },
  },
  defaultVariants: {
    variant: 'default',
    inputSize: 'md',
  },
});

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof inputVariants> {}

/**
 * Form input field with focus states and validation variants.
 *
 * @example
 * ```tsx
 * <Input
 *   type="email"
 *   placeholder="you@example.com"
 *   variant="default"
 *   inputSize="md"
 * />
 * <Input variant="invalid" placeholder="Error state" />
 * ```
 *
 * @see {@link ../README.md} for detailed variant documentation
 */
export const Input = ({
  variant,
  inputSize,
  className,
  ref,
  ...props
}: InputProps & { ref?: React.RefObject<HTMLInputElement | null> }) => {
  return (
    <input ref={ref} className={cn(inputVariants({ variant, inputSize }), className)} {...props} />
  );
};

Input.displayName = 'Input';

export default Input;
