import { Handshake, Star } from 'lucide-react';
import { cn } from '@/ui/primitives';

export function Footer() {
  return (
    <footer
      className={cn(
        'relative',
        'border-t',
        'border-slate-200/40',
        'dark:border-slate-700/40',
        'bg-gradient-to-b',
        'from-white/60',
        'to-sky-50/30',
        'dark:from-slate-900/60',
        'dark:to-slate-900/80',
        'backdrop-blur-md'
      )}
    >
      <div className={cn('max-w-6xl', 'mx-auto', 'px-4', 'sm:px-8', 'py-8')}>
        <div
          className={cn(
            'flex',
            'flex-col',
            'md:flex-row',
            'md:items-start',
            'md:justify-between',
            'gap-6',
            'mb-6'
          )}
        >
          <div className={cn('flex', 'flex-col', 'gap-2', 'items-start')}>
            <img src="/tbf-logo.svg" alt="Two Bit Foundry" className={cn('h-10', 'w-auto')} />
            <p className={cn('text-sm', 'text-slate-600', 'dark:text-slate-400')}>
              Built in the open with the community
            </p>
          </div>

          <div
            className={cn(
              'flex',
              'flex-col',
              'md:flex-row',
              'w-full',
              'md:w-auto',
              'gap-2',
              'md:gap-3'
            )}
          >
            <a
              href="https://github.com/TwoBitFoundry/sumurai/blob/main/CONTRIBUTING.md"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'px-4',
                'py-2',
                'text-sm',
                'font-subheading',
                'uppercase',
                'rounded-lg',
                'bg-sky-500/80',
                'backdrop-blur-sm',
                'text-white',
                'hover:bg-sky-600/80',
                'dark:bg-sky-600/80',
                'dark:hover:bg-sky-700/80',
                'flex',
                'items-center',
                'justify-center',
                'gap-2',
                'transition-colors',
                'border',
                'border-sky-400/30',
                'dark:border-sky-500/30',
                'whitespace-nowrap'
              )}
            >
              <Handshake className={cn('h-4', 'w-4')} />
              Forge with us
            </a>
            <a
              href="https://www.buymeacoffee.com/twobitfoundry"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'px-4',
                'py-2',
                'text-sm',
                'font-subheading',
                'uppercase',
                'rounded-lg',
                'bg-amber-500/80',
                'backdrop-blur-sm',
                'text-white',
                'hover:bg-amber-600/80',
                'dark:bg-amber-600/80',
                'dark:hover:bg-amber-700/80',
                'flex',
                'items-center',
                'justify-center',
                'gap-2',
                'transition-colors',
                'border',
                'border-amber-400/30',
                'dark:border-amber-500/30',
                'whitespace-nowrap'
              )}
            >
              <img
                src="https://cdn.buymeacoffee.com/buttons/bmc-new-btn-logo.svg"
                alt="Buy me a coffee"
                className={cn('h-5', 'w-5')}
              />
              <span>Buy us a coffee</span>
            </a>
            <a
              href="https://github.com/TwoBitFoundry/sumurai"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'px-4',
                'py-2',
                'text-sm',
                'font-subheading',
                'uppercase',
                'rounded-lg',
                'border',
                'border-slate-200',
                'dark:border-slate-700',
                'bg-white/50',
                'dark:bg-slate-800/50',
                'text-slate-700',
                'dark:text-slate-300',
                'hover:bg-white',
                'dark:hover:bg-slate-800',
                'flex',
                'items-center',
                'justify-center',
                'gap-2',
                'whitespace-nowrap'
              )}
            >
              <Star className={cn('h-4', 'w-4')} />
              <span>Star us on GitHub</span>
            </a>
          </div>
        </div>

        <div
          className={cn(
            'flex',
            'flex-col',
            'sm:flex-row',
            'sm:items-center',
            'sm:justify-between',
            'gap-4',
            'pt-5',
            'border-t',
            'border-slate-200/40',
            'dark:border-slate-700/40'
          )}
        >
          <p className={cn('text-xs', 'text-slate-500', 'dark:text-slate-500')}>
            © {new Date().getFullYear()} Two Bit Foundry • Source available
          </p>
          <div className={cn('flex', 'flex-wrap', 'items-center', 'gap-4', 'sm:gap-6')}>
            <a
              href="mailto:contact@twobitfoundry.com"
              className={cn(
                'text-xs',
                'text-slate-600',
                'dark:text-slate-400',
                'hover:text-sky-600',
                'dark:hover:text-sky-400'
              )}
            >
              Contact
            </a>
            <a
              href="mailto:support@twobitfoundry.com"
              className={cn(
                'text-xs',
                'text-slate-600',
                'dark:text-slate-400',
                'hover:text-sky-600',
                'dark:hover:text-sky-400'
              )}
            >
              Support
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
