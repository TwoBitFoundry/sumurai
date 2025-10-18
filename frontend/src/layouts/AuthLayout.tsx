import { type ReactNode } from 'react'
import { GradientShell } from '../ui/primitives'
import { Footer } from '../components/Footer'
import { cn } from '../ui/primitives/utils'

interface AuthLayoutProps {
  children: ReactNode
  className?: string
}

export function AuthLayout({ children, className }: AuthLayoutProps) {
  return (
    <div className={cn('flex', 'min-h-screen', 'flex-col')}>
      <GradientShell variant="auth" className={cn('flex-1', className)}>
        {children}
      </GradientShell>
      <Footer />
    </div>
  )
}

export default AuthLayout
