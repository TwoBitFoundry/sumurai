import { Trash2 } from 'lucide-react';
import { type RefObject, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CustomCategory } from '@/types/api';
import { Button, cn, ModalDrawerHeader, modalDrawerSectionLabelClassName } from '@/ui/primitives';
import {
  control,
  floatingChromeGlass,
  border as uiBorderRecipes,
  effect as uiEffectRecipes,
  radius as uiRadiusRecipes,
  surface as uiSurfaceRecipes,
  text as uiTextRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';
import {
  ANCHORED_POPOVER_GAP_PX,
  type AnchoredPopoverPosition,
  clampAnchoredPopoverPosition,
  resolveAnchoredPopoverWidth,
} from '@/utils/anchoredPopoverPosition';
import { useDeleteCustomCategory } from '../hooks/useDeleteCustomCategory';

interface Props {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  category: CustomCategory | null;
  onRequestClose: () => void;
  onSuccess?: () => void;
}

export function DeleteCustomCategoryConfirm({
  open,
  anchorRef,
  category,
  onRequestClose,
  onSuccess,
}: Props) {
  const { deleteCustomCategoryAsync, isPending, error } = useDeleteCustomCategory();
  const [mounted, setMounted] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState<AnchoredPopoverPosition | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const dialog = popoverRef.current;

      if (
        anchorRef.current &&
        !anchorRef.current.contains(target) &&
        dialog &&
        !dialog.contains(target)
      ) {
        onRequestClose();
      }
    };

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [anchorRef, onRequestClose, open]);

  useLayoutEffect(() => {
    if (!open) {
      setPopoverPosition(null);
      return;
    }

    const updatePosition = () => {
      const trigger = anchorRef.current;
      if (!trigger) {
        return;
      }

      const triggerRect = trigger.getBoundingClientRect();
      const popoverWidth =
        popoverRef.current?.offsetWidth ?? resolveAnchoredPopoverWidth(window.innerWidth);
      const popoverHeight = popoverRef.current?.offsetHeight ?? 0;

      setPopoverPosition(
        clampAnchoredPopoverPosition({
          triggerRect,
          popoverWidth,
          popoverHeight: popoverHeight || 1,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          gapPx: ANCHORED_POPOVER_GAP_PX,
        })
      );
    };

    updatePosition();

    let frame: number | undefined;
    const scheduleMeasure = () => {
      if (popoverRef.current?.offsetHeight) {
        updatePosition();
        return;
      }
      frame = requestAnimationFrame(scheduleMeasure);
    };
    scheduleMeasure();

    window.addEventListener('resize', updatePosition);

    return () => {
      if (frame !== undefined) {
        cancelAnimationFrame(frame);
      }
      window.removeEventListener('resize', updatePosition);
    };
  }, [anchorRef, open]);

  const handleDelete = async () => {
    if (!category) {
      return;
    }

    await deleteCustomCategoryAsync(category.id);
    onSuccess?.();
    onRequestClose();
  };

  if (!mounted || !open || !popoverPosition) {
    return null;
  }

  return createPortal(
    <div
      ref={popoverRef}
      role="dialog"
      aria-labelledby="delete-custom-category-title"
      aria-describedby="delete-custom-category-description"
      data-testid="delete-custom-category-popover"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          onRequestClose();
        }
      }}
      style={{
        bottom: popoverPosition.bottom,
        left: popoverPosition.left,
        transform: 'translateX(-50%)',
      }}
      className={cn(
        'fixed',
        'z-50',
        'w-[min(calc(100vw-2rem),20rem)]',
        'flex',
        'flex-col',
        'overflow-hidden',
        uiRadiusRecipes.standard,
        'border',
        ...uiBorderRecipes.floatingChrome,
        ...uiSurfaceRecipes.floatingChromePanel,
        ...uiEffectRecipes.glassDropShadow,
        ...floatingChromeGlass.backdrop
      )}
    >
      <div className={cn('space-y-4', 'p-4')}>
        <ModalDrawerHeader
          onClose={onRequestClose}
          closeLabel="Cancel delete category"
          closeDisabled={isPending}
        >
          <h2 id="delete-custom-category-title" className={cn(modalDrawerSectionLabelClassName)}>
            {category ? `Delete '${category.display_name}'?` : 'Delete custom category?'}
          </h2>
        </ModalDrawerHeader>
        <p
          id="delete-custom-category-description"
          className={cn(uiTypographyRecipes.caption, uiTextRecipes.muted)}
        >
          Transactions in this category will fall back to their original assigned category.
        </p>
        {error ? (
          <p className={cn('text-sm text-red-600 dark:text-red-300')}>
            {error instanceof Error ? error.message : 'Failed to delete category.'}
          </p>
        ) : null}
        <div className={cn('flex', 'justify-end')}>
          <Button
            type="button"
            variant="danger"
            onClick={() => {
              void handleDelete();
            }}
            disabled={!category || isPending}
          >
            <Trash2 className={cn(control.glyph.md)} aria-hidden="true" />
            {isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default DeleteCustomCategoryConfirm;
