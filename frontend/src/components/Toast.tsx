import React from 'react'
import { motion } from 'framer-motion'

import { Button, GlassCard } from '@/ui/primitives'

interface ToastProps {
  message: string
  onClose: () => void
}

export const Toast: React.FC<ToastProps> = ({ message, onClose }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed bottom-6 right-6 z-50 max-w-sm"
    >
      <GlassCard variant="accent" rounded="xl" padding="md" className="flex items-center gap-4" withInnerEffects={false}>
        <div className="flex-1 text-sm font-medium text-slate-900 dark:text-white">{message}</div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="uppercase tracking-[0.2em]"
          onClick={onClose}
        >
          Close
        </Button>
      </GlassCard>
    </motion.div>
  )
}
