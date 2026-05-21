import type { ThemePreference } from '@/context/ThemeContext';
import { appTitleBarRecipes } from '@/ui/primitives/AppTitleBar';
import { Button } from '@/ui/primitives/Button';
import { cn } from '@/ui/primitives/utils';
import { text as uiTextRecipes, font as uiTypographyRecipes } from '@/ui/recipes';

const themeModes: Array<{ value: ThemePreference; label: string }> = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
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
        ...appTitleBarRecipes.pillContainer,
        ...appTitleBarRecipes.settingsPillInset,
        ...appTitleBarRecipes.settingsPillSize
      )}
      role="radiogroup"
      aria-label="Theme"
    >
      {themeModes.map(({ value: option, label }) => {
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
            className={cn(
              ...appTitleBarRecipes.contextPillTab,
              ...appTitleBarRecipes.contextPillTabSize,
              'h-full',
              'w-full',
              'min-w-0',
              active ? uiTextRecipes.inverse : uiTextRecipes.muted
            )}
          >
            <span className={cn('relative', 'z-10', uiTypographyRecipes.bodyStrong)}>{label}</span>
          </Button>
        );
      })}
    </div>
  );
}

export default ThemeModeSelector;
