import React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn, glassBackdropClasses } from './utils'

const glassCardVariants = cva(
  [
    'relative overflow-hidden',
    'border',
    'shadow-[0_40px_120px_-82px_rgba(15,23,42,0.75)]',
    glassBackdropClasses,
    'transition-colors duration-500',
    'dark:shadow-[0_42px_140px_-80px_rgba(2,6,23,0.85)]',
  ],
  {
    variants: {
      variant: {
        default: [
          'border-white/35',
          'bg-white/18',
          'dark:border-white/12',
          'dark:bg-[#0f172a]/55',
        ],
        auth: [
          'border-white/35',
          'bg-white/20',
          'shadow-[0_38px_120px_-60px_rgba(15,23,42,0.78)]',
          'backdrop-blur-[26px]',
          'backdrop-saturate-[140%]',
          'dark:border-white/12',
          'dark:bg-[#0f172a]/55',
          'dark:shadow-[0_40px_120px_-58px_rgba(2,6,23,0.85)]',
        ],
        accent: [
          'border-white/40',
          'bg-white/85',
          'backdrop-blur-sm',
          'dark:border-white/10',
          'dark:bg-[#111a2f]/75',
        ],
      },
      rounded: {
        default: 'rounded-[2.25rem]',
        lg: 'rounded-2xl',
        xl: 'rounded-3xl',
      },
      padding: {
        none: 'p-0',
        sm: 'p-4',
        md: 'p-6',
        lg: 'p-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      rounded: 'default',
      padding: 'md',
    },
  }
)

export interface GlassCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof glassCardVariants> {
  children: React.ReactNode
  withInnerEffects?: boolean
  containerClassName?: string
}

/**
 * Container with glassmorphism effect (backdrop blur, semi-transparency, subtle borders).
 *
 * @example
 * ```tsx
 * <GlassCard variant="default" padding="lg">
 *   <h2>Card Title</h2>
 *   <p>Card content...</p>
 * </GlassCard>
 * ```
 *
 * @param withInnerEffects - Enable inner ring and gradient overlay (default: true)
 * @param containerClassName - Applied to outer container
 * @param className - Applied to inner content wrapper
 *
 * @see {@link ../README.md} for detailed variant documentation
 */
export function GlassCard({
  children,
  variant,
  rounded,
  padding,
  withInnerEffects = true,
  className,
  containerClassName,
  ...props
}: GlassCardProps) {
  const roundedClass = rounded === 'default' ? 'rounded-[2.25rem]' : rounded === 'lg' ? 'rounded-2xl' : 'rounded-3xl'

  return (
    <div
      className={cn(glassCardVariants({ variant, rounded, padding }), containerClassName)}
      {...props}
    >
      {withInnerEffects && (
        <div className={cn('pointer-events-none', 'absolute', 'inset-0')}>
          <div
            className={cn(
              'absolute inset-0',
              roundedClass,
              'ring-inset ring-1',
              'ring-white/40',
              'shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-1px_0_rgba(15,23,42,0.18)]',
              'dark:ring-white/10',
              'dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-1px_0_rgba(2,6,23,0.5)]'
            )}
          />
          <div
            className={cn(
              'absolute inset-0',
              roundedClass,
              'bg-gradient-to-b',
              'from-white/65 via-white/25 to-transparent',
              'transition-colors duration-500',
              'dark:from-slate-900/68 dark:via-slate-900/34 dark:to-transparent'
            )}
          />
        </div>
      )}
      <div className={cn('relative z-10', padding === 'none' ? '' : '', className)}>
        {children}
      </div>
    </div>
  )
}

export default GlassCard