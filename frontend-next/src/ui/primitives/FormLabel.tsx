import { cva, type VariantProps } from 'class-variance-authority';
import type React from 'react';
import { cn } from './utils';

const labelVariants = cva(['block text-xs font-semibold uppercase tracking-[0.18em]'], {
  variants: {
    tone: {
      default: 'text-slate-700 dark:text-slate-200',
      subtle: 'text-slate-500 dark:text-slate-400',
    },
  },
  defaultVariants: {
    tone: 'default',
  },
});

export interface FormLabelProps
  extends React.LabelHTMLAttributes<HTMLLabelElement>,
  VariantProps<typeof labelVariants> { }

export function FormLabel({ tone, className, ...props }: FormLabelProps) {
  // biome-ignore lint/a11y/noLabelWithoutControl: htmlFor is passed via props
  return <label className={cn(labelVariants({ tone }), className)} {...props} />;
}

export default FormLabel;
