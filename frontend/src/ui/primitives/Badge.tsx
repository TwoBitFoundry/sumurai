import React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn, transitionClasses } from './utils'

const badgeVariants = cva(
  [
    'inline-flex items-center justify-center',
    'font-semibold uppercase',
    transitionClasses,
  ],
  {
    variants: {
      variant: {
        default: [
          'bg-white/70 text-slate-600',
          'shadow-[0_12px_32px_-22px_rgba(15,23,42,0.45)]',
          'dark:bg-[#1e293b]/70 dark:text-slate-200',
        ],
        primary: [
          'bg-[#93c5fd]/20 text-[#0ea5e9]',
          'dark:bg-[#38bdf8]/20 dark:text-[#38bdf8]',
        ],
        feature: [
          'bg-[#f8fafc] ring-1 ring-inset',
          'dark:bg-[#1e293b]',
        ],
      },
      size: {
        xs: 'px-2 py-0.5 text-[10px] tracking-[0.2em] rounded-md',
        sm: 'px-2.5 py-1 text-[11px] tracking-[0.24em] rounded-lg',
        md: 'px-3 py-1 text-xs tracking-[0.24em] rounded-full',
        lg: 'px-3.5 py-1.5 text-xs tracking-[0.3em] rounded-full',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  children: React.ReactNode
}

export function Badge({
  variant,
  size,
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    >
      {children}
    </span>
  )
}

export default Badge
