import { Handshake, Star } from 'lucide-react';
import { cn } from '@/ui/primitives';
import {
  border as uiBorderRecipes,
  radius as uiRadiusRecipes,
  surface as uiSurfaceRecipes,
  text as uiTextRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';

export function Footer() {
  return (
    <footer
      className={cn(
        'relative',
        'border-t',
        ...uiBorderRecipes.divider,
        'bg-gradient-to-b',
        'from-white/60',
        'to-sky-50/30',
        'dark:from-slate-900/60',
        'dark:to-slate-900/80',
        'backdrop-blur-md',
        'pb-[env(safe-area-inset-bottom)]'
      )}
    >
      <div
        className={cn(
          'max-w-6xl',
          'mx-auto',
          'pl-[calc(1rem_+_env(safe-area-inset-left))] pr-[calc(1rem_+_env(safe-area-inset-right))]',
          'md:pl-[calc(2rem_+_env(safe-area-inset-left))] md:pr-[calc(2rem_+_env(safe-area-inset-right))]',
          'py-8'
        )}
      >
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
            <p className={cn(uiTypographyRecipes.body, uiTextRecipes.muted)}>
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
                uiTypographyRecipes.label,
                uiTextRecipes.inverse,
                uiRadiusRecipes.standard,
                'bg-sky-500/80',
                'backdrop-blur-sm',
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
                uiTypographyRecipes.label,
                uiTextRecipes.inverse,
                uiRadiusRecipes.standard,
                'bg-amber-500/80',
                'backdrop-blur-sm',
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
              <img src="/bmc-new-btn-logo.svg" alt="Buy me a coffee" className={cn('h-5', 'w-5')} />
              <span>Buy us a coffee</span>
            </a>
            <a
              href="https://github.com/TwoBitFoundry/sumurai"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'px-4',
                'py-2',
                uiTypographyRecipes.label,
                uiTextRecipes.body,
                uiRadiusRecipes.standard,
                'border',
                ...uiBorderRecipes.default,
                ...uiSurfaceRecipes.card,
                'hover:bg-[var(--color-surface-hover-row)]',
                'dark:hover:bg-[var(--color-surface-hover-row)]',
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
            'md:flex-row',
            'md:items-center',
            'md:justify-between',
            'gap-4',
            'pt-5',
            'border-t',
            ...uiBorderRecipes.divider
          )}
        >
          <p className={cn(uiTypographyRecipes.caption, uiTextRecipes.subtle)}>
            © {new Date().getFullYear()} Two Bit Foundry • Source available
          </p>
          <div className={cn('flex', 'flex-wrap', 'items-center', 'gap-4', 'md:gap-6')}>
            <a
              href="mailto:contact@twobitfoundry.com"
              className={cn(
                uiTypographyRecipes.caption,
                uiTextRecipes.accent,
                'transition-opacity',
                'hover:opacity-80'
              )}
            >
              Contact
            </a>
            <a
              href="mailto:support@twobitfoundry.com"
              className={cn(
                uiTypographyRecipes.caption,
                uiTextRecipes.accent,
                'transition-opacity',
                'hover:opacity-80'
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
