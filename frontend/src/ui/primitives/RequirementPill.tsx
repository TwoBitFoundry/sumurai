import React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from './utils'

const requirementVariants = cva(
  ['inline-flex items-center rounded-full px-2.5 py-1 text-[0.7rem] font-medium transition-colors duration-200'],
  {
    variants: {
      status: {
        pending: 'bg-white/60 text-slate-500 dark:bg-white/5 dark:text-slate-400',
        met: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300',
      },
    },
    defaultVariants: {
      status: 'pending',
    },
  }
)

export interface RequirementPillProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof requirementVariants> {
  children: React.ReactNode
}

export function RequirementPill({ status, className, children, ...props }: RequirementPillProps) {
  return (
    <span className={cn(requirementVariants({ status }), className)} {...props}>
      {children}
    </span>
  )
}

export default RequirementPill
