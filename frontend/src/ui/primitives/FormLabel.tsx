import { cva, type VariantProps } from 'class-variance-authority';
import type React from 'react';
import { text as uiTextRecipes, font as uiTypographyRecipes } from '@/ui/recipes';
import { cn } from './utils';

const labelVariants = cva(['block', uiTypographyRecipes.label], {
  variants: {
    tone: {
      default: uiTextRecipes.label,
      subtle: uiTextRecipes.subtle,
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
