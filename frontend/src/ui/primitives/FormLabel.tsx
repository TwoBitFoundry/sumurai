import { cva, type VariantProps } from 'class-variance-authority';
import type React from 'react';
import { designTokens } from '@/ui/tokens';
import { cn } from './utils';

const labelVariants = cva(['block', designTokens.typography.label], {
  variants: {
    tone: {
      default: designTokens.text.label,
      subtle: designTokens.text.subtle,
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
  // biome-ignore lint/a11y/noLabelWithoutControl: htmlFor is passed via props
  return <label className={cn(labelVariants({ tone }), className)} {...props} />;
}

export default FormLabel;
