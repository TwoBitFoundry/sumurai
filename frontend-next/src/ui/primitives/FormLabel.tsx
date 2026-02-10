import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
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
    VariantProps<typeof labelVariants> {}

export function FormLabel({ tone, className, ...props }: FormLabelProps) {
  return <label className={cn(labelVariants({ tone }), className)} {...props} />;
}

export default FormLabel;
