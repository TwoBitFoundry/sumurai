import { type ReactNode } from 'react'
import { GradientShell } from '../ui/primitives'
import { cn } from '../ui/primitives/utils'

interface AuthLayoutProps {
  children: ReactNode
  className?: string
}

export function AuthLayout({ children, className }: AuthLayoutProps) {
  return (
    <GradientShell variant="auth" className={cn('', className)}>
      {children}
    </GradientShell>
  )
}

export default AuthLayout
