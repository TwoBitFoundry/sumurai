import * as Popover from '@radix-ui/react-popover';
import { Check } from 'lucide-react';
import {
  type ChangeEvent,
  type FormEvent,
  type RefObject,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useCategories } from '@/features/transactions/hooks/useCategories';
import { useCreateCustomCategory } from '@/features/transactions/hooks/useCreateCustomCategory';
import { cn, IconButton, Input, Pill } from '@/ui/primitives';
import {
  formatCategoryName,
  getTagThemeForCategory,
  validateCustomCategoryName,
} from '@/utils/categories';

interface Props {
  open: boolean;
  anchorRef: RefObject<HTMLElement>;
  currentCategory: { name: string; isCustom: boolean };
  onSelect: (selection: { categoryName: string; isCustom: boolean }) => void;
  onRequestClose: () => void;
}

const validationMessages = {
  empty: 'Enter a category name.',
  invalid_characters: 'Use letters and spaces only.',
  too_long: 'Keep it to 30 characters or fewer.',
  too_many_words: 'Use up to 3 words.',
  collides_system: 'That matches an existing system category.',
  collides_custom: 'That matches an existing custom category.',
} as const;

export function CategoryPicker({
  open,
  anchorRef,
  currentCategory,
  onSelect,
  onRequestClose,
}: Props) {
  const { system, custom } = useCategories();
  const { createCustomCategoryAsync, isPending } = useCreateCustomCategory();
  const [typedName, setTypedName] = useState('');
  const [hasInteracted, setHasInteracted] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setTypedName('');
    setHasInteracted(false);
  }, [open]);

  const validation = useMemo(
    () =>
      validateCustomCategoryName(typedName, {
        system,
        custom,
      }),
    [custom, system, typedName]
  );

  const displayName = validation.display ?? typedName;
  const canSubmit =
    validation.ok &&
    validation.display !== currentCategory.name &&
    !isPending &&
    displayName.trim().length > 0;
  const validationMessage =
    hasInteracted && !validation.ok && validation.code ? validationMessages[validation.code] : null;

  const handleTypedChange = (event: ChangeEvent<HTMLInputElement>) => {
    setHasInteracted(true);
    setTypedName(formatTypedCategoryDisplay(event.target.value));
  };

  const handleSuggestedSelect = async (categoryName: string, isCustom: boolean) => {
    onSelect({ categoryName, isCustom });
    onRequestClose();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validation.ok || !validation.display || !canSubmit) {
      return;
    }

    const created = await createCustomCategoryAsync(validation.display);

    onSelect({ categoryName: created.display_name, isCustom: true });
    onRequestClose();
  };

  return (
    <Popover.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onRequestClose();
        }
      }}
    >
      <Popover.Anchor virtualRef={anchorRef} />
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="start"
          sideOffset={10}
          className={cn(
            'z-50',
            'w-[min(92vw,28rem)]',
            'rounded-[2rem]',
            'border',
            'border-white/65',
            'bg-[color:color-mix(in_srgb,var(--color-surface-glass-panel)_88%,white)]',
            'p-4',
            'shadow-[0_24px_60px_-36px_rgba(15,23,42,0.42)]',
            'backdrop-blur-2xl',
            'dark:border-white/10',
            'dark:bg-[#0f172a]/90'
          )}
        >
          <div className={cn('flex max-h-[70vh] flex-col gap-4')}>
            <section className={cn('space-y-3')}>
              <div className={cn('flex items-center justify-between gap-3')}>
                <p
                  className={cn(
                    'text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400'
                  )}
                >
                  Suggested
                </p>
              </div>
              <div className={cn('max-h-56 overflow-y-auto pr-1')}>
                <div className={cn('flex flex-wrap gap-2')}>
                  {system.map((categoryName) => {
                    const label = formatCategoryName(categoryName);
                    const selected =
                      !currentCategory.isCustom && currentCategory.name === categoryName;
                    const theme = getTagThemeForCategory(label);

                    return (
                      <button
                        key={categoryName}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => {
                          void handleSuggestedSelect(categoryName, false);
                        }}
                        className={cn(
                          'inline-flex rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus-active)] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#0f172a]',
                          selected &&
                            'ring-2 ring-[var(--color-border-focus-active)] ring-offset-2 ring-offset-white dark:ring-offset-[#0f172a]'
                        )}
                      >
                        <Pill
                          categoryName={label}
                          className={cn(
                            'transition-transform duration-200',
                            theme.tag,
                            selected && 'scale-[1.02]'
                          )}
                        >
                          {label}
                        </Pill>
                      </button>
                    );
                  })}
                  {custom.map((category) => {
                    const selected =
                      currentCategory.isCustom && currentCategory.name === category.display_name;

                    return (
                      <button
                        key={category.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => {
                          void handleSuggestedSelect(category.display_name, true);
                        }}
                        className={cn(
                          'inline-flex rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus-active)] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#0f172a]',
                          selected &&
                            'ring-2 ring-[var(--color-border-focus-active)] ring-offset-2 ring-offset-white dark:ring-offset-[#0f172a]'
                        )}
                      >
                        <Pill
                          categoryName={category.display_name}
                          className={cn(
                            'transition-transform duration-200',
                            selected && 'scale-[1.02]'
                          )}
                        >
                          {category.display_name}
                        </Pill>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            <div className={cn('h-px', 'bg-black/10', 'dark:bg-white/10')} />

            <form className={cn('space-y-2')} onSubmit={handleSubmit}>
              <div className={cn('flex items-start gap-2')}>
                <div className={cn('min-w-0 flex-1 space-y-1')}>
                  <label
                    htmlFor="category-picker-custom"
                    className={cn(
                      'text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400'
                    )}
                  >
                    Type your own
                  </label>
                  <Input
                    id="category-picker-custom"
                    aria-label="Type your own"
                    value={typedName}
                    onChange={handleTypedChange}
                    variant={validationMessage ? 'invalid' : 'default'}
                    placeholder="Weekend Brunch"
                  />
                  {validationMessage ? (
                    <p className={cn('text-sm text-red-600 dark:text-red-300')}>
                      {validationMessage}
                    </p>
                  ) : null}
                </div>
                <IconButton
                  type="submit"
                  aria-label="Confirm category"
                  size="md"
                  variant="success"
                  disabled={!canSubmit}
                  className={cn('mt-[1.625rem] shrink-0')}
                >
                  <Check />
                </IconButton>
              </div>
            </form>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export default CategoryPicker;

function formatTypedCategoryDisplay(raw: string): string {
  return raw.toLowerCase().replace(/\b[a-z]/g, (char) => char.toUpperCase());
}
