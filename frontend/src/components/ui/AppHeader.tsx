import { cva } from 'class-variance-authority'
import { Sun, Moon } from 'lucide-react'
import { Button } from '@/ui/primitives'
import { cn } from '@/ui/primitives/utils'
import { useTheme } from '@/context/ThemeContext'

interface AppHeaderProps {
  onLogout: () => void
  variant?: 'default' | 'onboarding'
}

const headerVariants = cva(
  'border-b transition-colors duration-300',
  {
    variants: {
      variant: {
        default: 'sticky top-0 z-50 bg-white/80 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-800/80 border-slate-200',
        onboarding: 'fixed inset-x-0 top-0 z-20 bg-white/40 backdrop-blur-xl border-white/30 dark:border-slate-700/30 dark:bg-slate-900/40',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export function AppHeader({ onLogout, variant = 'default' }: AppHeaderProps) {
  const { mode, toggle } = useTheme()

  return (
    <header className={headerVariants({ variant })}>
      <div className={cn('flex', 'h-14', 'items-center', 'justify-between', 'px-4')}>
        <div
          className={cn(
            'flex items-center',
            'text-lg font-semibold',
            'text-slate-900 transition-colors',
            'dark:text-slate-100'
          )}
        >
          Sumaura
        </div>
        <div className={cn('flex', 'items-center', 'gap-2')}>
          <Button
            variant="secondary"
            size="sm"
            onClick={toggle}
            aria-label="Toggle theme"
            title="Toggle theme"
            className="px-2.5"
          >
            {mode === 'dark' ? <Moon className={cn('h-4', 'w-4')} /> : <Sun className={cn('h-4', 'w-4')} />}
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={onLogout}
            title="Logout"
            className={cn('px-3 py-1 text-xs')}
          >
            Logout
          </Button>
        </div>
      </div>
    </header>
  )
}