import React from 'react'
import { AnimatePresence, motion, type HTMLMotionProps } from 'framer-motion'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from './utils'

const contentVariants = cva('relative w-full', {
  variants: {
    size: {
      sm: 'max-w-sm',
      md: 'max-w-md',
      lg: 'max-w-2xl',
    },
  },
  defaultVariants: {
    size: 'md',
  },
})

export interface ModalProps
  extends Omit<HTMLMotionProps<'div'>, 'children'>,
    VariantProps<typeof contentVariants> {
  isOpen: boolean
  onClose?: () => void
  children: React.ReactNode
  labelledBy?: string
  description?: string
  preventCloseOnBackdrop?: boolean
  backdropClassName?: string
  containerClassName?: string
}

export function Modal({
  isOpen,
  onClose,
  children,
  size,
  labelledBy,
  description,
  preventCloseOnBackdrop,
  className,
  backdropClassName,
  containerClassName,
  ...props
}: ModalProps) {
  const handleBackdropClick = () => {
    if (!preventCloseOnBackdrop) {
      onClose?.()
    }
  }

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          className={cn('fixed inset-0 z-50', containerClassName)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className={cn('grid', 'h-full', 'place-items-center', 'p-4')}>
            <motion.button
              type="button"
              aria-hidden="true"
              tabIndex={-1}
              className={cn('absolute inset-0 bg-slate-900/70 backdrop-blur-sm', backdropClassName)}
              onClick={handleBackdropClick}
              data-testid="modal-backdrop"
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby={labelledBy}
              aria-describedby={description}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={cn(contentVariants({ size }), className)}
              {...props}
            >
              {children}
            </motion.div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

export default Modal