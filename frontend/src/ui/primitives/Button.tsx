import { cva, type VariantProps } from 'class-variance-authority';
import type React from 'react';
import {
  buttonChrome,
  buttonCta,
  chrome,
  control,
  border as semanticBorders,
  status as semanticStatus,
  surface as semanticSurfaces,
  text as semanticTextRecipes,
  successCta,
  radius as uiRadiusRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';
import {
  ControlHoverLabel,
  resolveControlHoverLabel,
  shouldShowButtonHoverLabel,
} from './ControlHoverLabel';
import { cn } from './utils';

export const buttonTypographySizes = {
  sm: control.label.sm,
  md: control.label.md,
  lg: control.label.lg,
} as const;

const titleBarChromeExpandedTypography =
  'font-caption text-[0.875rem] font-semibold uppercase leading-none tracking-[0.14em]';

export const connectButtonRecipes = {
  base: [
    `inline-flex items-center gap-2 rounded-full px-5 py-2 ${uiTypographyRecipes.captionStrong} whitespace-nowrap`,
    'transition-all duration-200',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
    'dark:focus-visible:ring-offset-slate-900',
    'disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0',
  ],
  secondary: [
    ...buttonChrome.secondary,
    ...semanticSurfaces.mutedChip,
    semanticTextRecipes.muted,
    'hover:border-[var(--color-border-default)] hover:bg-[var(--color-surface-hover-row)] hover:text-[var(--color-text-primary)]',
    'dark:text-[#cbd5e1]',
    'dark:hover:border-[var(--color-border-default)] dark:hover:bg-[var(--color-surface-hover-row)] dark:hover:text-white',
  ],
} as const;

export const buttonRecipes = {
  base: [
    'inline-flex items-center justify-center gap-2',
    'cursor-pointer',
    'uppercase',
    'transition-all duration-200 ease-out',
    'active:scale-[0.98]',
    'disabled:active:scale-100',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-sky-400/80 dark:focus-visible:ring-offset-slate-900',
    'disabled:cursor-not-allowed disabled:opacity-60',
  ],
  primary: [
    ...buttonCta.gradient,
    semanticTextRecipes.inverse,
    ...buttonCta.glow,
    ...buttonCta.hover,
  ],
  secondary: [
    ...buttonChrome.secondary,
    ...semanticSurfaces.card,
    semanticTextRecipes.muted,
    'hover:-translate-y-0.5',
    'hover:border-[var(--color-border-default)] hover:bg-[var(--color-surface-hover-row)] hover:text-slate-900',
    'disabled:hover:translate-y-0',
    'dark:text-slate-300',
    'dark:hover:border-[var(--color-border-default)] dark:hover:bg-[var(--color-surface-hover-row)] dark:hover:text-white',
  ],
  ghost: [
    ...buttonChrome.ghost,
    ...semanticSurfaces.glassPanel,
    semanticTextRecipes.primary,
    'hover:-translate-y-0.5',
    'hover:border-[var(--color-border-control)]',
    'dark:hover:border-[color:color-mix(in_srgb,var(--color-border-glass)_20%,transparent)]',
    'dark:text-slate-200',
  ],
  icon: [
    ...buttonChrome.muted,
    ...semanticSurfaces.mutedChip,
    semanticTextRecipes.muted,
    'hover:-translate-y-[1px] hover:border-[var(--color-border-default)]',
    'hover:text-slate-900',
    'dark:text-slate-400',
    'dark:hover:border-[var(--color-border-default)] dark:hover:text-white',
  ],
  filterChip: ['hover:-translate-y-[2px]', 'disabled:hover:translate-y-0'],
  tab: [
    'group',
    'relative',
    'overflow-hidden',
    'border-transparent',
    'bg-transparent',
    'hover:-translate-y-0.5',
    'disabled:hover:translate-y-0',
  ],
  tabActive: [
    'group relative',
    'overflow-visible',
    ...semanticBorders.glass,
    'bg-[var(--color-brand-azure)]',
    'text-white',
    'dark:border-[var(--color-border-glass)]',
    ...buttonCta.glow,
  ],
  danger: [
    'border dark:border-0',
    ...semanticStatus.danger.alertBorder,
    ...semanticStatus.danger.surface,
    ...semanticStatus.danger.text,
    'hover:-translate-y-0.5',
    'hover:bg-[var(--color-status-danger-strong-surface)]',
    'disabled:hover:translate-y-0',
    'dark:hover:bg-[color:color-mix(in_srgb,var(--color-status-danger-strong-surface)_46%,transparent)]',
  ],
  success: [
    ...successCta.gradient,
    semanticTextRecipes.inverse,
    ...successCta.glow,
    ...successCta.hover,
    'disabled:hover:translate-y-0',
  ],
  connect: [
    ...buttonCta.gradient,
    semanticTextRecipes.inverse,
    ...buttonCta.glow,
    ...buttonCta.hover,
  ],
} as const;

const buttonVariants = cva([...buttonRecipes.base], {
  variants: {
    variant: {
      primary: [...buttonRecipes.primary],
      secondary: [...buttonRecipes.secondary],
      ghost: [...buttonRecipes.ghost],
      icon: [...buttonRecipes.icon],
      filterChip: [...buttonRecipes.filterChip],
      tab: [...buttonRecipes.tab],
      tabActive: [...buttonRecipes.tabActive],
      danger: [...buttonRecipes.danger],
      success: [...buttonRecipes.success],
      connect: [...buttonRecipes.connect],
    },
    size: {
      sm: '',
      md: '',
      lg: '',
      inherit: '',
      titleBarExpanded: '',
    },
    shape: {
      default: '',
      square: '',
      pill: '',
    },
  },
  defaultVariants: {
    variant: 'primary',
    size: 'md',
    shape: 'default',
  },
  compoundVariants: [
    {
      shape: 'default',
      size: 'sm',
      class: `${control.height.sm} ${control.paddingX.sm} ${control.label.sm} ${uiRadiusRecipes.standard}`,
    },
    {
      shape: 'default',
      size: 'md',
      class: `${control.height.md} ${control.paddingX.md} ${control.label.md} ${uiRadiusRecipes.standard}`,
    },
    {
      shape: 'default',
      size: 'lg',
      class: `${control.height.lg} ${control.paddingX.lg} ${control.label.lg} ${uiRadiusRecipes.standard}`,
    },
    {
      shape: 'default',
      size: 'titleBarExpanded',
      class: `${titleBarChromeExpandedTypography} ${chrome.sm}`,
    },
    {
      shape: 'square',
      size: 'sm',
      class: `${control.square.sm} p-0 ${uiRadiusRecipes.standard}`,
    },
    {
      shape: 'square',
      size: 'md',
      class: `${control.square.md} p-0 ${uiRadiusRecipes.standard}`,
    },
    {
      shape: 'square',
      size: 'lg',
      class: `${control.square.lg} p-0 ${uiRadiusRecipes.standard}`,
    },
    {
      shape: 'pill',
      size: 'sm',
      class: `max-w-full shrink-0 gap-1.5 rounded-full px-2.5 py-1 ${control.height.sm} ${uiTypographyRecipes.badge}`,
    },
    {
      shape: 'pill',
      size: 'md',
      class: `max-w-full shrink-0 gap-1.5 rounded-full px-3 py-1 ${control.height.md} ${uiTypographyRecipes.badge}`,
    },
  ],
});

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  children?: React.ReactNode;
}

export const Button = ({
  variant,
  size,
  shape,
  loading,
  disabled,
  className,
  children,
  ref,
  title,
  ...props
}: ButtonProps & { ref?: React.RefObject<HTMLButtonElement | null> }) => {
  const resolvedSize = size ?? 'md';
  const isSquare = shape === 'square';
  const glyphSize =
    resolvedSize === 'sm' || resolvedSize === 'md' || resolvedSize === 'lg' ? resolvedSize : 'md';
  const resolvedTitle = resolveControlHoverLabel(title, props['aria-label'], children);
  const showHoverLabel = shouldShowButtonHoverLabel(variant ?? 'primary', resolvedTitle);
  const isDisabled = Boolean(disabled || loading);

  const button = (
    <button
      ref={ref}
      disabled={isDisabled}
      className={cn(buttonVariants({ variant, size, shape }), className)}
      title={showHoverLabel ? undefined : resolvedTitle}
      {...props}
    >
      {isSquare ? (
        <span
          className={cn(
            'inline-flex',
            'shrink-0',
            'items-center',
            'justify-center',
            control.glyph[glyphSize],
            '[&_svg]:block',
            '[&_svg]:h-full',
            '[&_svg]:w-full'
          )}
        >
          {children}
        </span>
      ) : (
        children
      )}
    </button>
  );

  if (showHoverLabel && resolvedTitle) {
    return (
      <ControlHoverLabel label={resolvedTitle} disabled={isDisabled}>
        {button}
      </ControlHoverLabel>
    );
  }

  return button;
};

Button.displayName = 'Button';

export default Button;
