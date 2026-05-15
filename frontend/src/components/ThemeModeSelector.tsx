import { type ThemePreference } from '@/context/ThemeContext';
import { appTitleBarRecipes } from '@/ui/primitives/AppTitleBar';
import { Button } from '@/ui/primitives/Button';
import { cn } from '@/ui/primitives/utils';
import {
  border as semanticBorders,
  effect as semanticEffects,
  surface as semanticSurfaces,
  text as uiTextRecipes,
} from '@/ui/recipes';

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
        'inline-flex items-center gap-1 rounded-full border p-1',
        ...semanticSurfaces.glassPanel,
        ...semanticBorders.glass,
        ...semanticEffects.glassShadow
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
            size="xs"
            role="radio"
            aria-checked={active}
            className={cn(
              ...appTitleBarRecipes.pillTab,
              active ? uiTextRecipes.inverse : uiTextRecipes.muted
            )}
          >
            <span className="relative z-10">{label}</span>
          </Button>
        );
      })}
    </div>
  );
}

export default ThemeModeSelector;
