import * as Popover from '@radix-ui/react-popover';
import { Check } from 'lucide-react';
import {
  type ChangeEvent,
  type FormEvent,
  type RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useCategories } from '@/features/transactions/hooks/useCategories';
import { useCreateCustomCategory } from '@/features/transactions/hooks/useCreateCustomCategory';
import { useViewportBreakpoint } from '@/hooks/useViewportBreakpoint';
import type { CustomCategory } from '@/types/api';
import {
  cn,
  FormLabel,
  IconButton,
  Input,
  Modal,
  ModalDrawerHeader,
  modalDrawerSectionLabelClassName,
} from '@/ui/primitives';
import {
  brandNeutral,
  categoryPickerPopover,
  floatingChromeGlass,
  modalDrawer,
  font as uiTypographyRecipes,
} from '@/ui/recipes';
import { categoryThemeVars } from '@/ui/tokens';
import {
  formatCategoryName,
  getTagThemeForCategory,
  validateCustomCategoryName,
} from '@/utils/categories';
import DeleteCustomCategoryConfirm, {
  isDeleteCustomCategoryConfirmTarget,
} from './DeleteCustomCategoryConfirm';

interface CategoryCatalogPickerProps {
  open: boolean;
  anchorRef: RefObject<HTMLElement>;
  onRequestClose: () => void;
  onCategoryCreated?: (categoryName: string) => void;
  onCategoryDeleted?: (categoryName: string) => void;
}

const validationMessages = {
  empty: 'Enter a category name.',
  invalid_characters: 'Use letters and spaces only.',
  too_long: 'Keep it to 30 characters or fewer.',
  too_many_words: 'Use up to 3 words.',
  collides_system: 'That matches an existing system category.',
  collides_custom: 'That matches an existing custom category.',
} as const;

const readOnlyCategoryPillClasses = cn(
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
  'cursor-default'
);

export function CategoryCatalogPicker({
  open,
  anchorRef,
  onRequestClose,
  onCategoryCreated,
  onCategoryDeleted,
}: CategoryCatalogPickerProps) {
  const { system, custom, all, accentIndexByName } = useCategories();
  const customByDisplayName = useMemo(
    () => new Map(custom.map((category) => [category.display_name, category])),
    [custom]
  );
  const { createCustomCategoryAsync, isPending } = useCreateCustomCategory();
  const { isMobile } = useViewportBreakpoint();
  const [typedName, setTypedName] = useState('');
  const [hasInteracted, setHasInteracted] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CustomCategory | null>(null);
  const deleteAnchorRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setTypedName('');
    setHasInteracted(false);
    setDeleteTarget(null);
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
  const canSubmit = validation.ok && !isPending && displayName.trim().length > 0;
  const validationMessage =
    hasInteracted && !validation.ok && validation.code ? validationMessages[validation.code] : null;

  const handleTypedChange = (event: ChangeEvent<HTMLInputElement>) => {
    setHasInteracted(true);
    setTypedName(formatTypedCategoryDisplay(event.target.value));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validation.ok || !validation.display || !canSubmit) {
      return;
    }

    await createCustomCategoryAsync(validation.display);
    setTypedName('');
    setHasInteracted(false);
    onCategoryCreated?.(validation.display);
    onRequestClose();
  };

  const content = (
    <div
      data-testid="category-catalog-picker-content"
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
          closeLabel="Close category catalog"
        >
          <p className={cn(modalDrawerSectionLabelClassName)}>Manage Categories</p>
        </ModalDrawerHeader>
        <div
          className={cn(
            isMobile
              ? 'min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 pb-1 touch-pan-y'
              : 'max-h-56 overflow-y-auto pr-1'
          )}
        >
          <ul
            aria-label="Available categories"
            className={cn('flex flex-wrap gap-2', 'list-none', 'p-0', 'm-0')}
          >
            {all.map((categoryName) => {
              const customCategory = customByDisplayName.get(categoryName);
              const isCustom = customCategory != null;
              const label = formatCategoryName(categoryName);
              const theme = getTagThemeForCategory(categoryName, accentIndexByName);

              return (
                <li
                  key={isCustom ? customCategory.id : categoryName}
                  className={cn(
                    'group relative inline-flex items-center',
                    isCustom && 'transition-all duration-200 ease-out hover:-translate-y-[2px]'
                  )}
                >
                  <span
                    className={cn(readOnlyCategoryPillClasses, theme.tag, isCustom && 'pr-10')}
                    style={categoryThemeVars(theme)}
                  >
                    <span className="whitespace-nowrap">{label}</span>
                  </span>
                  {isCustom && customCategory ? (
                    <button
                      type="button"
                      aria-label={`Delete ${label}`}
                      title={`Delete ${label}`}
                      className={cn(
                        'absolute',
                        'right-0.5',
                        'top-1/2',
                        '-translate-y-1/2',
                        'inline-flex',
                        'h-6',
                        'w-6',
                        'items-center',
                        'justify-center',
                        'border-0',
                        'bg-transparent',
                        'p-0',
                        brandNeutral.textSubtle,
                        'text-sm',
                        'leading-none',
                        'transition-colors',
                        'duration-200',
                        'hover:bg-transparent',
                        brandNeutral.textHoverStrong,
                        'focus-visible:outline-none',
                        'focus-visible:ring-2',
                        'focus-visible:ring-[var(--color-border-focus-active)]',
                        'focus-visible:ring-offset-2',
                        'focus-visible:ring-offset-[var(--color-brand-fog)]',
                        'dark:focus-visible:ring-offset-[var(--color-brand-navy)]'
                      )}
                      onClick={(event) => {
                        deleteAnchorRef.current = event.currentTarget;
                        setDeleteTarget(customCategory);
                      }}
                    >
                      <span aria-hidden="true" className={cn('relative', '-top-px')}>
                        ×
                      </span>
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {!isMobile ? <div className={cn('h-px', 'bg-black/10', 'dark:bg-white/10')} /> : null}

      <form className={cn('space-y-2', isMobile && modalDrawer.formFooter)} onSubmit={handleSubmit}>
        <div className={cn(modalDrawer.formField)}>
          <FormLabel htmlFor="category-catalog-picker-custom">Make Your Own</FormLabel>
          <div className={cn('flex items-center gap-2')}>
            <div className={cn('min-w-0 flex-1')}>
              <Input
                id="category-catalog-picker-custom"
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
      <>
        <Modal
          isOpen={open}
          onClose={onRequestClose}
          presentation="drawer"
          labelledBy="category-catalog-picker-title"
          description="Browse categories and add your own"
          data-testid="category-catalog-picker-sheet"
          onInteractOutside={(event) => {
            if (shouldPreventCatalogDismiss(anchorRef, event.target)) {
              event.preventDefault();
            }
          }}
          onPointerDownOutside={(event) => {
            if (shouldPreventCatalogDismiss(anchorRef, event.target)) {
              event.preventDefault();
            }
          }}
          containerClassName={cn(
            'p-[env(safe-area-inset-top)_env(safe-area-inset-right)_env(safe-area-inset-bottom)_env(safe-area-inset-left)]'
          )}
          className={cn(
            'w-full max-w-none rounded-b-none rounded-t-[2rem]',
            ...floatingChromeGlass.shell,
            ...floatingChromeGlass.backdrop,
            'max-h-[min(50dvh,32rem)]',
            'overflow-hidden'
          )}
        >
          <h2 id="category-catalog-picker-title" className="sr-only">
            Manage categories
          </h2>
          {content}
        </Modal>
        {deleteTarget ? (
          <DeleteCustomCategoryConfirm
            open
            anchorRef={deleteAnchorRef}
            category={deleteTarget}
            onRequestClose={() => setDeleteTarget(null)}
            onSuccess={() => {
              onCategoryDeleted?.(deleteTarget.display_name);
              setDeleteTarget(null);
            }}
          />
        ) : null}
      </>
    );
  }

  return (
    <>
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
            data-testid="category-catalog-picker-popover"
            side="bottom"
            align="end"
            sideOffset={10}
            onInteractOutside={(event) => {
              if (shouldPreventCatalogDismiss(anchorRef, event.target)) {
                event.preventDefault();
              }
            }}
            onPointerDownOutside={(event) => {
              if (shouldPreventCatalogDismiss(anchorRef, event.target)) {
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
              ...floatingChromeGlass.backdrop,
              'p-4',
              'max-h-[min(50dvh,32rem)]',
              'overflow-hidden'
            )}
          >
            {content}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {deleteTarget ? (
        <DeleteCustomCategoryConfirm
          open
          anchorRef={deleteAnchorRef}
          category={deleteTarget}
          onRequestClose={() => setDeleteTarget(null)}
          onSuccess={() => {
            onCategoryDeleted?.(deleteTarget.display_name);
            setDeleteTarget(null);
          }}
        />
      ) : null}
    </>
  );
}

export default CategoryCatalogPicker;

function formatTypedCategoryDisplay(raw: string): string {
  return raw.toLowerCase().replace(/\b[a-z]/g, (char) => char.toUpperCase());
}

function shouldPreventCatalogDismiss(
  anchorRef: RefObject<HTMLElement>,
  target: EventTarget | null
): boolean {
  return (
    isDismissTargetWithinAnchor(anchorRef, target) || isDeleteCustomCategoryConfirmTarget(target)
  );
}

function isDismissTargetWithinAnchor(
  anchorRef: RefObject<HTMLElement>,
  target: EventTarget | null
): boolean {
  return target instanceof Node && anchorRef.current != null && anchorRef.current.contains(target);
}
