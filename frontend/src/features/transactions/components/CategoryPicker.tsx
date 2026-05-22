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
import { useViewportBreakpoint } from '@/hooks/useViewportBreakpoint';
import { cn, IconButton, Input, Modal, Pill } from '@/ui/primitives';
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
  const { isMobile } = useViewportBreakpoint();
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

  const content = (
    <div
      className={cn(
        'flex flex-col',
        isMobile ? 'max-h-[min(88dvh,42rem)] overflow-hidden' : 'max-h-[70vh] gap-4'
      )}
    >
      <section
        className={cn('space-y-3', isMobile && 'min-h-0 flex-1 overflow-hidden px-5 pb-4 pt-5')}
      >
        <div className={cn('flex items-center justify-between gap-3')}>
          <p
            className={cn(
              'text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400'
            )}
          >
            Suggested
          </p>
        </div>
        <div
          className={cn(
            isMobile ? 'min-h-0 flex-1 overflow-y-auto pr-1' : 'max-h-56 overflow-y-auto pr-1'
          )}
        >
          <div className={cn('flex flex-wrap gap-2')}>
            {system.map((categoryName) => {
              const label = formatCategoryName(categoryName);
              const selected = !currentCategory.isCustom && currentCategory.name === categoryName;
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
                    'inline-flex min-h-11 items-center rounded-full px-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus-active)] focus-visible:ring-offset-2 focus-visible:ring-offset-white md:min-h-9 dark:focus-visible:ring-offset-[#0f172a]',
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
                    'inline-flex min-h-11 items-center rounded-full px-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus-active)] focus-visible:ring-offset-2 focus-visible:ring-offset-white md:min-h-9 dark:focus-visible:ring-offset-[#0f172a]',
                    selected &&
                      'ring-2 ring-[var(--color-border-focus-active)] ring-offset-2 ring-offset-white dark:ring-offset-[#0f172a]'
                  )}
                >
                  <Pill
                    categoryName={category.display_name}
                    className={cn('transition-transform duration-200', selected && 'scale-[1.02]')}
                  >
                    {category.display_name}
                  </Pill>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {!isMobile ? <div className={cn('h-px', 'bg-black/10', 'dark:bg-white/10')} /> : null}

      <form
        className={cn(
          'space-y-2',
          isMobile &&
            'mt-auto border-t border-black/10 bg-[color:color-mix(in_srgb,var(--color-surface-glass-panel)_96%,white)] px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 dark:border-white/10 dark:bg-[#0f172a]/98'
        )}
        onSubmit={handleSubmit}
      >
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
              <p className={cn('text-sm text-red-600 dark:text-red-300')}>{validationMessage}</p>
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
  );

  if (isMobile) {
    return (
      <Modal
        isOpen={open}
        onClose={onRequestClose}
        labelledBy="category-picker-title"
        description="Choose or create a transaction category"
        data-testid="category-picker-sheet"
        containerClassName={cn(
          'p-[env(safe-area-inset-top)_env(safe-area-inset-right)_env(safe-area-inset-bottom)_env(safe-area-inset-left)]'
        )}
        gridClassName={cn('items-end', 'p-0')}
        className={cn(
          'w-full max-w-none rounded-b-none rounded-t-[2rem] border border-white/65 bg-[color:color-mix(in_srgb,var(--color-surface-glass-panel)_92%,white)] shadow-[0_24px_60px_-36px_rgba(15,23,42,0.42)] backdrop-blur-2xl dark:border-white/10 dark:bg-[#0f172a]/96'
        )}
      >
        <h2 id="category-picker-title" className="sr-only">
          Edit category
        </h2>
        {content}
      </Modal>
    );
  }

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
          data-testid="category-picker-popover"
          side="bottom"
          align="start"
          sideOffset={10}
          className={cn(
            'z-50',
            'w-[min(92vw,28rem)]',
            'min-w-[22rem]',
            'md:w-[min(30rem,calc(100vw-4rem))]',
            'lg:w-[min(28rem,32vw)]',
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
          {content}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export default CategoryPicker;

function formatTypedCategoryDisplay(raw: string): string {
  return raw.toLowerCase().replace(/\b[a-z]/g, (char) => char.toUpperCase());
}
