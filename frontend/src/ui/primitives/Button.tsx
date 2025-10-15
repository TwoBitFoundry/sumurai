import React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn, focusRingClasses, disabledClasses, transitionClasses } from './utils'

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2',
    'font-semibold',
    transitionClasses,
    focusRingClasses,
    disabledClasses,
  ],
  {
    variants: {
      variant: {
        primary: [
          'bg-gradient-to-r from-sky-500 via-sky-400 to-violet-500',
          'text-white',
          'shadow-[0_22px_60px_-32px_rgba(14,165,233,0.85)]',
          'hover:-translate-y-0.5',
          'disabled:hover:translate-y-0',
        ],
        secondary: [
          'border border-slate-200/70 bg-white/70',
          'text-slate-600',
          'shadow-[0_14px_38px_-30px_rgba(15,23,42,0.45)]',
          'hover:border-sky-300/50 hover:text-slate-900',
          'hover:shadow-[0_14px_32px_-18px_rgba(56,189,248,0.35)]',
          'dark:border-white/10 dark:bg-white/5',
          'dark:text-slate-300',
          'dark:hover:border-sky-500/60 dark:hover:text-white',
        ],
        ghost: [
          'border border-white/50 bg-white/70',
          'text-slate-800',
          'shadow-[0_12px_30px_-20px_rgba(15,23,42,0.45)]',
          'hover:-translate-y-0.5',
          'dark:border-white/15 dark:bg-[#1e293b]/70',
          'dark:text-slate-200',
        ],
        icon: [
          'border border-transparent bg-white/75',
          'text-slate-600',
          'shadow-[0_14px_36px_-28px_rgba(15,23,42,0.45)]',
          'hover:-translate-y-[1px] hover:border-sky-300',
          'hover:text-slate-900',
          'dark:bg-[#1e293b]/85',
          'dark:text-slate-400',
          'dark:hover:border-sky-400 dark:hover:text-white',
        ],
        tab: [
          'group relative',
          'overflow-hidden',
          'backdrop-blur-sm',
        ],
        tabActive: [
          'group relative',
          'overflow-hidden',
          'border border-white/65',
          'bg-[linear-gradient(115deg,#38bdf8_0%,#22d3ee_46%,#a855f7_100%)]',
          'text-white',
          'shadow-[0_16px_42px_-18px_rgba(14,165,233,0.55)]',
          'backdrop-blur-sm',
          'before:absolute before:inset-0',
          'before:bg-[linear-gradient(140deg,rgba(255,255,255,0.38)_0%,rgba(255,255,255,0)_60%)]',
          'before:opacity-80 before:pointer-events-none',
          'dark:border-white/20',
          'dark:shadow-[0_16px_38px_-18px_rgba(56,189,248,0.55)]',
        ],
        danger: [
          'border border-red-200 bg-red-50',
          'text-red-600',
          'hover:bg-red-100',
          'dark:border-red-700 dark:bg-red-900/20',
          'dark:text-red-400',
          'dark:hover:bg-red-900/30',
        ],
        success: [
          'bg-gradient-to-r from-emerald-500 via-emerald-400 to-sky-400',
          'text-white',
          'shadow-[0_20px_55px_-28px_rgba(16,185,129,0.65)]',
          'hover:-translate-y-[3px]',
          'disabled:hover:translate-y-0',
        ],
        connect: [
          'bg-gradient-to-r from-[#0ea5e9] via-[#38bdf8] to-[#a78bfa]',
          'text-white',
          'shadow-[0_22px_60px_-32px_rgba(14,165,233,0.78)]',
          'hover:-translate-y-[1px]',
          'hover:shadow-[0_28px_70px_-35px_rgba(14,165,233,0.85)]',
          'active:scale-[0.98]',
          'dark:shadow-[0_22px_60px_-32px_rgba(56,189,248,0.65)]',
        ],
      },
      size: {
        xs: 'px-2.5 py-1 text-xs rounded-xl',
        sm: 'px-3 py-1.5 text-sm rounded-xl',
        md: 'px-4 py-2 text-sm rounded-full',
        lg: 'px-5 py-2.5 text-base rounded-full',
        icon: 'h-10 w-10 rounded-full',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean
  children?: React.ReactNode
}

/**
 * Interactive button component with multiple visual styles.
 *
 * @example
 * ```tsx
 * <Button variant="primary" size="lg">Submit</Button>
 * <Button variant="secondary" size="md">Cancel</Button>
 * <Button variant="icon" size="icon"><CloseIcon /></Button>
 * ```
 *
 * @see {@link ../README.md} for detailed variant documentation
 */
export function Button({
  variant,
  size,
  loading,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    >
      {children}
    </button>
  )
}

export default Button
