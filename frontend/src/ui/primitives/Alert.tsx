import { cva, type VariantProps } from 'class-variance-authority';
import type React from 'react';
import {
  radius as uiRadiusRecipes,
  status as uiStatusRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';
import { cn } from './utils';

const alertVariants = cva(
  [
    `relative ${uiRadiusRecipes.standard} border px-4 py-3 shadow-sm`,
    'transition-colors duration-300',
  ],
  {
    variants: {
      variant: {
        info: [
          ...uiStatusRecipes.info.border,
          ...uiStatusRecipes.info.surface,
          ...uiStatusRecipes.info.text,
        ],
        success: [
          ...uiStatusRecipes.success.border,
          ...uiStatusRecipes.success.surface,
          ...uiStatusRecipes.success.text,
        ],
        warning: [
          ...uiStatusRecipes.warning.border,
          ...uiStatusRecipes.warning.surface,
          ...uiStatusRecipes.warning.text,
        ],
        error: [
          ...uiStatusRecipes.danger.border,
          ...uiStatusRecipes.danger.surface,
          ...uiStatusRecipes.danger.text,
        ],
      },
      tone: {
        solid: 'backdrop-blur-sm backdrop-saturate-[140%]',
        subtle: 'backdrop-blur-xs backdrop-saturate-[120%]',
      },
    },
    defaultVariants: {
      variant: 'info',
      tone: 'solid',
    },
  }
);

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  title?: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}

export function Alert({ variant, tone, title, icon, className, children, ...props }: AlertProps) {
  if (icon && title) {
    return (
      <div className={cn(alertVariants({ variant, tone }), className)} {...props}>
        <div className={cn('flex', 'w-full', 'flex-col', 'gap-1')}>
          <div className={cn('flex', 'items-center', 'gap-3')}>
            <span
              className={cn(
                'inline-flex',
                'shrink-0',
                'items-center',
                'justify-center',
                'leading-none'
              )}
            >
              {icon}
            </span>
            <p className={cn(uiTypographyRecipes.captionStrong, 'opacity-85')}>{title}</p>
          </div>
          <div className={cn('w-full', uiTypographyRecipes.body)}>{children}</div>
        </div>
      </div>
    );
  }

  if (icon) {
    return (
      <div className={cn(alertVariants({ variant, tone }), className)} {...props}>
        <div className={cn('flex', 'items-start', 'gap-3')}>
          <span
            className={cn(
              'mt-0.5',
              'inline-flex',
              'shrink-0',
              'items-center',
              'justify-center',
              'leading-none'
            )}
          >
            {icon}
          </span>
          <div className={cn('min-w-0', 'flex-1', uiTypographyRecipes.body)}>{children}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(alertVariants({ variant, tone }), className)} {...props}>
      <div className={cn('flex', 'w-full', 'flex-col', 'gap-1')}>
        {title ? (
          <p className={cn(uiTypographyRecipes.captionStrong, 'opacity-85')}>{title}</p>
        ) : null}
        <div className={cn(uiTypographyRecipes.body)}>{children}</div>
      </div>
    </div>
  );
}

export default Alert;
