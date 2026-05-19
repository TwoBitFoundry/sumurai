import type React from 'react';
import { Footer } from '@/components/Footer';

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
export const AppFooter = ({
  ref,
  ..._props
}: Record<string, never> & { ref?: React.RefObject<HTMLDivElement | null> }) => {
  return (
    <div ref={ref} className="w-full">
      <Footer />
    </div>
  );
};

AppFooter.displayName = 'AppFooter';

export default AppFooter;
