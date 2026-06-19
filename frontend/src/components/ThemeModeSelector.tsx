import { motion } from 'framer-motion';
import { type LucideIcon, Monitor, Moon, Sun } from 'lucide-react';
import type { ThemePreference } from '@/context/ThemeContext';
import { appTitleBarRecipes } from '@/ui/primitives/AppTitleBar';
import { Button } from '@/ui/primitives/Button';
import { cn } from '@/ui/primitives/utils';
import { text as uiTextRecipes } from '@/ui/recipes';

export const THEME_MODE_SELECTOR_ACTIVE_PILL_LAYOUT_ID = 'theme-mode-selector-pill-active';

const themeModes: Array<{ value: ThemePreference; label: string; icon: LucideIcon }> = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
];

interface ThemeModeSelectorProps {
  value: ThemePreference;
  onChange: (value: ThemePreference) => void;
}

export function ThemeModeSelector({ value, onChange }: ThemeModeSelectorProps) {
  return (
    <div
      className={cn(
        'grid',
        'w-full',
        'grid-cols-3',
        'items-stretch',
        'gap-1',
        ...appTitleBarRecipes.settingsPillContainer,
        ...appTitleBarRecipes.settingsPillInset,
        ...appTitleBarRecipes.settingsPillSize
      )}
      role="radiogroup"
      aria-label="Theme"
    >
      {themeModes.map(({ value: option, label, icon: Icon }) => {
        const active = option === value;

        return (
          <Button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            variant={active ? 'tabActive' : 'tab'}
            size="inherit"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            className={cn(
              ...appTitleBarRecipes.contextPillTab,
              ...appTitleBarRecipes.contextPillTabSize,
              'h-full',
              'w-full',
              'min-w-0',
              active ? uiTextRecipes.inverse : uiTextRecipes.muted
            )}
          >
            {active ? (
              <motion.div
                layout
                layoutId={THEME_MODE_SELECTOR_ACTIVE_PILL_LAYOUT_ID}
                data-slot="active-pill"
                className={cn('absolute inset-0 rounded-[length:inherit] bg-[inherit]')}
                transition={{ type: 'spring', stiffness: 400, damping: 35 }}
              />
            ) : null}
            <span
              className={cn('relative', 'z-10', 'shrink-0', ...appTitleBarRecipes.pillTabIconWell)}
            >
              <Icon className={cn(...appTitleBarRecipes.pillTabIcon)} aria-hidden="true" />
            </span>
          </Button>
        );
      })}
    </div>
  );
}

export default ThemeModeSelector;
