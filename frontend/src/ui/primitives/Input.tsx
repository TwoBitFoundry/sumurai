import React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn, focusRingClasses, disabledClasses, transitionClasses } from './utils'

const inputVariants = cva(
  [
    'w-full',
    'px-4',
    'border',
    'font-medium',
    'shadow-[0_18px_45px_-30px_rgba(15,23,42,0.45)]',
    transitionClasses,
    'focus:outline-none',
    disabledClasses,
  ],
  {
    variants: {
      variant: {
        default: [
          'bg-white text-slate-900',
          'border-black/10',
          'focus:ring-2 focus:ring-sky-400',
          'focus:ring-offset-2 focus:ring-offset-white',
          'dark:bg-[#111a2f] dark:text-white',
          'dark:border-white/12',
          'dark:focus:ring-sky-400/80',
          'dark:focus:ring-offset-[#0f172a]',
        ],
        invalid: [
          'bg-white text-slate-900',
          'border-red-300',
          'focus:ring-2 focus:ring-red-400',
          'focus:ring-offset-2 focus:ring-offset-white',
          'dark:bg-[#111a2f] dark:text-white',
          'dark:border-red-600/80',
          'dark:focus:ring-red-400/75',
          'dark:focus:ring-offset-[#0f172a]',
        ],
        glass: [
          'bg-white/80 text-slate-700',
          'border-white/60',
          'shadow-[0_18px_45px_-32px_rgba(15,23,42,0.5)]',
          'focus:ring-2 focus:ring-sky-400/80',
          'focus:ring-offset-2 focus:ring-offset-white',
          'dark:bg-[#111a2f]/80 dark:text-slate-100',
          'dark:border-white/12',
          'dark:focus:ring-offset-[#0f172a]',
        ],
      },
      inputSize: {
        sm: 'py-1.5 text-xs rounded-lg',
        md: 'py-2.5 text-sm rounded-xl',
        lg: 'py-3 text-base rounded-xl',
      },
    },
    defaultVariants: {
      variant: 'default',
      inputSize: 'md',
    },
  }
)

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof inputVariants> {}

/**
 * Form input field with focus states and validation variants.
 *
 * @example
 * ```tsx
 * <Input
 *   type="email"
 *   placeholder="you@example.com"
 *   variant="default"
 *   inputSize="md"
 * />
 * <Input variant="invalid" placeholder="Error state" />
 * ```
 *
 * @see {@link ../README.md} for detailed variant documentation
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ variant, inputSize, className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(inputVariants({ variant, inputSize }), className)}
        {...props}
      />
    )
  }
)

Input.displayName = 'Input'

export default Input
