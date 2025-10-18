import React from 'react'
import { Footer } from '@/components/Footer'

/**
 * Viewport-spanning footer wrapper.
 *
 * Wraps the existing Footer component to ensure consistent viewport-width behavior
 * across all app states (unauthenticated, onboarding, authenticated).
 *
 * @example
 * ```tsx
 * <AppFooter />
 * ```
 */
export const AppFooter = React.forwardRef<HTMLDivElement, Record<string, never>>((_props, ref) => {
  return (
    <div ref={ref} className="w-full">
      <Footer />
    </div>
  )
})

AppFooter.displayName = 'AppFooter'

export default AppFooter
