import { Handshake, Star } from 'lucide-react';
import { cn } from '@/ui/primitives';
import {
  appLayout,
  border as uiBorderRecipes,
  radius as uiRadiusRecipes,
  surface as uiSurfaceRecipes,
  text as uiTextRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';

const footerActionTypography = [
  uiTypographyRecipes.caption,
  'lg:font-label',
  'lg:text-[0.75rem]',
  'lg:font-semibold',
  'lg:uppercase',
  'lg:leading-none',
  'lg:tracking-[0.14em]',
] as const;

const footerActionLink = [
  'shrink-0',
  'px-2',
  'py-1.5',
  'lg:px-4',
  'lg:py-2',
  ...footerActionTypography,
  uiRadiusRecipes.standard,
  'flex',
  'items-center',
  'justify-center',
  'gap-1',
  'lg:gap-2',
  'whitespace-nowrap',
  'transition-colors',
] as const;

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
          ...appLayout.contentShell,
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
              Forging better systems for founders
            </p>
          </div>

          <div
            className={cn(
              'flex',
              'min-w-0',
              'max-w-full',
              'flex-row',
              'flex-nowrap',
              'gap-2',
              'overflow-x-auto',
              'md:w-auto',
              'lg:gap-3'
            )}
          >
            <a
              href="https://github.com/TwoBitFoundry/sumurai/blob/main/CONTRIBUTING.md"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                footerActionLink,
                uiTextRecipes.inverse,
                'bg-sky-500/80',
                'backdrop-blur-sm',
                'hover:bg-sky-600/80',
                'dark:bg-sky-600/80',
                'dark:hover:bg-sky-700/80',
                'border',
                'border-sky-400/30',
                'dark:border-sky-500/30'
              )}
            >
              <Handshake className={cn('h-3.5', 'w-3.5', 'lg:h-4', 'lg:w-4')} />
              Forge with us
            </a>
            <a
              href="https://www.buymeacoffee.com/twobitfoundry"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                footerActionLink,
                uiTextRecipes.inverse,
                'bg-amber-500/80',
                'backdrop-blur-sm',
                'hover:bg-amber-600/80',
                'dark:bg-amber-600/80',
                'dark:hover:bg-amber-700/80',
                'border',
                'border-amber-400/30',
                'dark:border-amber-500/30'
              )}
            >
              <img
                src="/bmc-new-btn-logo.svg"
                alt=""
                className={cn('h-4', 'w-4', 'lg:h-5', 'lg:w-5')}
              />
              Buy us a coffee
            </a>
            <a
              href="https://github.com/TwoBitFoundry/sumurai"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                footerActionLink,
                uiTextRecipes.body,
                'border',
                ...uiBorderRecipes.default,
                ...uiSurfaceRecipes.card,
                'hover:bg-[var(--color-surface-hover-row)]',
                'dark:hover:bg-[var(--color-surface-hover-row)]'
              )}
            >
              <Star className={cn('h-3.5', 'w-3.5', 'lg:h-4', 'lg:w-4')} />
              GitHub
            </a>
          </div>
        </div>

        <div
          className={cn(
            'flex',
            'flex-row',
            'items-center',
            'justify-between',
            'gap-4',
            'pt-5',
            'border-t',
            ...uiBorderRecipes.divider
          )}
        >
          <p className={cn('min-w-0', uiTypographyRecipes.caption, uiTextRecipes.subtle)}>
            © {new Date().getFullYear()}{' '}
            <a
              href="https://twobitfoundry.com"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(uiTextRecipes.accent, 'transition-opacity', 'hover:opacity-80')}
            >
              Two Bit Foundry
            </a>{' '}
            •{' '}
            <a
              href="https://github.com/TwoBitFoundry/sumurai/blob/main/LICENSE"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(uiTextRecipes.accent, 'transition-opacity', 'hover:opacity-80')}
            >
              License
            </a>
          </p>
          <div
            className={cn('flex', 'shrink-0', 'items-center', 'justify-end', 'gap-4', 'md:gap-6')}
          >
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
