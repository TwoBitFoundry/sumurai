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
import {
  cn,
  IconButton,
  Input,
  Modal,
  ModalDrawerHeader,
  modalDrawerSectionLabelClassName,
} from '@/ui/primitives';
import {
  categoryPickerPopover,
  floatingChromeGlass,
  modalDrawer,
  font as uiTypographyRecipes,
} from '@/ui/recipes';
import {
  formatCategoryName,
  getTagThemeForCategoryAtIndex,
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

const suggestedCategoryButtonClasses = cn(
  'inline-flex',
  'w-fit',
  'max-w-full',
  'items-center',
  'gap-1.5',
  'rounded-full',
  'border',
  'px-2.5',
  'py-1',
  'min-h-11',
  'md:min-h-9',
  'lg:min-h-8',
  uiTypographyRecipes.badge,
  'transition-all',
  'duration-200',
  'ease-out',
  'hover:-translate-y-0.5',
  'focus-visible:outline-none',
  'focus-visible:ring-2',
  'focus-visible:ring-inset',
  'focus-visible:ring-[var(--color-border-focus-active)]',
  'disabled:cursor-not-allowed',
  'disabled:opacity-60',
  'disabled:hover:translate-y-0'
);

export function CategoryPicker({
  open,
  anchorRef,
  currentCategory,
  onSelect,
  onRequestClose,
}: Props) {
  const { system, custom, all } = useCategories();
  const customByDisplayName = useMemo(
    () => new Map(custom.map((category) => [category.display_name, category])),
    [custom]
  );
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

  const handleSuggestedSelect = (categoryName: string, isCustom: boolean, selected: boolean) => {
    if (selected) {
      onRequestClose();
      return;
    }
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
      data-testid="category-picker-content"
      className={cn(
        'flex flex-col',
        isMobile ? 'h-[min(50dvh,32rem)] overflow-hidden' : 'max-h-[70vh] gap-4'
      )}
    >
      <section
        className={cn(
          'space-y-3',
          isMobile && 'flex min-h-0 flex-1 flex-col overflow-hidden px-5 pb-4 pt-5'
        )}
      >
        <ModalDrawerHeader
          closeWithDialog={isMobile}
          onClose={onRequestClose}
          closeLabel="Close category picker"
        >
          <p className={cn(modalDrawerSectionLabelClassName)}>Customize Category</p>
        </ModalDrawerHeader>
        <div
          className={cn(
            isMobile
              ? 'min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 pb-1 touch-pan-y'
              : 'max-h-56 overflow-y-auto pr-1'
          )}
        >
          <div className={cn('flex flex-wrap gap-2')}>
            {all.map((categoryName, index) => {
              const customCategory = customByDisplayName.get(categoryName);
              const isCustom = customCategory != null;
              const label = formatCategoryName(categoryName);
              const selected = isCustom
                ? currentCategory.isCustom && currentCategory.name === categoryName
                : !currentCategory.isCustom && currentCategory.name === categoryName;
              const theme = getTagThemeForCategoryAtIndex(index);

              return (
                <button
                  key={isCustom ? customCategory.id : categoryName}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    handleSuggestedSelect(categoryName, isCustom, selected);
                  }}
                  className={cn(
                    suggestedCategoryButtonClasses,
                    theme.tag,
                    selected && 'ring-2 ring-inset ring-[var(--color-border-focus-active)]'
                  )}
                >
                  <span className="whitespace-nowrap">{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {!isMobile ? <div className={cn('h-px', 'bg-black/10', 'dark:bg-white/10')} /> : null}

      <form className={cn('space-y-2', isMobile && modalDrawer.formFooter)} onSubmit={handleSubmit}>
        <div className={cn(modalDrawer.formField)}>
          <label htmlFor="category-picker-custom" className={cn(modalDrawerSectionLabelClassName)}>
            Make Your Own
          </label>
          <div className={cn('flex items-center gap-2')}>
            <div className={cn('min-w-0 flex-1')}>
              <Input
                id="category-picker-custom"
                aria-label="Make Your Own"
                value={typedName}
                onChange={handleTypedChange}
                variant={validationMessage ? 'floatingChromeInvalid' : 'floatingChrome'}
                placeholder="Weekend Brunch"
              />
            </div>
            <IconButton
              type="submit"
              aria-label="Confirm category"
              size="md"
              variant="success"
              disabled={!canSubmit}
              className={cn(modalDrawer.submitButton)}
            >
              <Check />
            </IconButton>
          </div>
          {validationMessage ? (
            <p className={cn('text-sm text-red-600 dark:text-red-300')}>{validationMessage}</p>
          ) : null}
        </div>
      </form>
    </div>
  );

  if (isMobile) {
    return (
      <Modal
        isOpen={open}
        onClose={onRequestClose}
        presentation="drawer"
        labelledBy="category-picker-title"
        description="Choose or create a transaction category"
        data-testid="category-picker-sheet"
        containerClassName={cn(
          'p-[env(safe-area-inset-top)_env(safe-area-inset-right)_env(safe-area-inset-bottom)_env(safe-area-inset-left)]'
        )}
        className={cn(
          'w-full max-w-none rounded-b-none rounded-t-[2rem]',
          ...floatingChromeGlass.shell,
          'backdrop-blur-2xl',
          'backdrop-saturate-[150%]',
          'max-h-[min(50dvh,32rem)]',
          'overflow-hidden'
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
          onInteractOutside={(event) => {
            if (isDismissTargetWithinAnchor(anchorRef, event.target)) {
              event.preventDefault();
            }
          }}
          onPointerDownOutside={(event) => {
            if (isDismissTargetWithinAnchor(anchorRef, event.target)) {
              event.preventDefault();
            }
          }}
          className={cn(
            ...categoryPickerPopover.motion,
            'z-50',
            'w-[min(92vw,24rem)]',
            'min-w-[18rem]',
            'md:w-[min(26rem,calc(100vw-4rem))]',
            'lg:w-[min(24rem,28vw)]',
            'rounded-[2rem]',
            ...floatingChromeGlass.shell,
            'backdrop-blur-2xl',
            'backdrop-saturate-[150%]',
            'p-4',
            'max-h-[min(50dvh,32rem)]',
            'overflow-hidden'
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

function isDismissTargetWithinAnchor(
  anchorRef: RefObject<HTMLElement>,
  target: EventTarget | null
): boolean {
  return target instanceof Node && anchorRef.current != null && anchorRef.current.contains(target);
}
