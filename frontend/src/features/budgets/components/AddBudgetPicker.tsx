import * as Popover from '@radix-ui/react-popover';
import { Check } from 'lucide-react';
import { type FormEvent, type RefObject, useEffect, useMemo } from 'react';
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
import { formatCategoryName, getTagThemeForCategory } from '@/utils/categories';

export interface BudgetFormValue {
  category: string;
  amount: string;
}

interface Props {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  categories: string[];
  accentIndexByName: ReadonlyMap<string, number>;
  value: BudgetFormValue;
  onChange: (value: BudgetFormValue) => void;
  onSave: () => void;
  onRequestClose: () => void;
}

const categoryOptionButtonClasses = cn(
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

export function AddBudgetPicker({
  open,
  anchorRef,
  categories,
  accentIndexByName,
  value,
  onChange,
  onSave,
  onRequestClose,
}: Props) {
  const { isMobile } = useViewportBreakpoint();
  const amountNum = Number(value.amount);
  const canSubmit = value.category.trim().length > 0 && Number.isFinite(amountNum) && amountNum > 0;

  useEffect(() => {
    if (!open || !value.category) {
      return;
    }
    if (!categories.includes(value.category)) {
      onChange({ category: '', amount: value.amount });
    }
  }, [categories, onChange, open, value.amount, value.category]);

  const handleCategorySelect = (categoryName: string, selected: boolean) => {
    onChange({
      ...value,
      category: selected ? '' : categoryName,
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }
    onSave();
  };

  const content = (
    <div
      data-testid="add-budget-picker-content"
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
          closeLabel="Close add budget picker"
        >
          <p className={cn(modalDrawerSectionLabelClassName)}>Add Budget Category</p>
        </ModalDrawerHeader>
        <div
          className={cn(
            isMobile
              ? 'min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 pb-1 touch-pan-y'
              : 'max-h-56 overflow-y-auto pr-1'
          )}
        >
          {categories.length === 0 ? (
            <p className={cn('text-sm text-slate-600 dark:text-slate-300')}>
              Every category already has a budget.
            </p>
          ) : (
            <div className={cn('flex flex-wrap gap-2')}>
              {categories.map((categoryName) => {
                const label = formatCategoryName(categoryName);
                const selected = value.category === categoryName;
                const theme = getTagThemeForCategory(categoryName, accentIndexByName);

                return (
                  <button
                    key={categoryName}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      handleCategorySelect(categoryName, selected);
                    }}
                    className={cn(
                      categoryOptionButtonClasses,
                      theme.tag,
                      selected && 'ring-2 ring-inset ring-[var(--color-border-focus-active)]'
                    )}
                  >
                    <span className="whitespace-nowrap">{label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {!isMobile ? <div className={cn('h-px', 'bg-black/10', 'dark:bg-white/10')} /> : null}

      <form className={cn('space-y-2', isMobile && modalDrawer.formFooter)} onSubmit={handleSubmit}>
        <div className={cn(modalDrawer.formField)}>
          <label htmlFor="add-budget-amount" className={cn(modalDrawerSectionLabelClassName)}>
            Amount
          </label>
          <div className={cn('flex items-center gap-2')}>
            <div className={cn('min-w-0 flex-1')}>
              <Input
                id="add-budget-amount"
                data-testid="budget-amount-input"
                type="number"
                min={0}
                step="0.01"
                aria-label="Amount"
                value={value.amount}
                onChange={(event) => onChange({ ...value, amount: event.target.value })}
                variant="floatingChrome"
                placeholder="240"
              />
            </div>
            <IconButton
              type="submit"
              aria-label="Save budget"
              size="md"
              variant="success"
              disabled={!canSubmit}
              className={cn(modalDrawer.submitButton)}
            >
              <Check />
            </IconButton>
          </div>
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
        labelledBy="add-budget-picker-title"
        description="Add a category budget"
        data-testid="add-budget-picker-sheet"
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
        <h2 id="add-budget-picker-title" className="sr-only">
          Add budget
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
          data-testid="add-budget-picker-popover"
          side="bottom"
          align="end"
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

export default AddBudgetPicker;

function isDismissTargetWithinAnchor(
  anchorRef: RefObject<HTMLElement | null>,
  target: EventTarget | null
): boolean {
  return target instanceof Node && anchorRef.current != null && anchorRef.current.contains(target);
}
