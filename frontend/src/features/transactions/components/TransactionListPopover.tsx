import * as Popover from '@radix-ui/react-popover';
import { ArrowUpRight } from 'lucide-react';
import type { RefObject } from 'react';
import type {
  TransactionListContext,
  TransactionWindowFilters,
} from '@/features/transactions/models/transactionWindow';
import { useViewportBreakpoint } from '@/hooks/useViewportBreakpoint';
import {
  cn,
  IconButton,
  Modal,
  ModalDrawerHeader,
  modalDrawerSectionLabelClassName,
} from '@/ui/primitives';
import { categoryPickerPopover, floatingChromeGlass, radius } from '@/ui/recipes';
import type { NavigateToTransactionsDetail } from '@/utils/events';
import { dispatchNavigateToTransactions } from '@/utils/events';
import VirtualizedTransactionList from './VirtualizedTransactionList';

interface Props {
  open: boolean;
  anchorRef: RefObject<HTMLElement>;
  context: TransactionListContext;
  onRequestClose: () => void;
}

function contextToFilters(context: TransactionListContext): TransactionWindowFilters {
  switch (context.type) {
    case 'budget':
      return {
        categoryPrimary: context.category,
        startDate: context.startDate,
        endDate: context.endDate,
      };
    case 'category':
      return { categoryPrimary: context.category };
    case 'merchant':
      return { merchant: context.merchant };
    case 'account':
      return { accountIds: [context.accountId] };
  }
}

function contextToNavigateDetail(context: TransactionListContext): NavigateToTransactionsDetail {
  switch (context.type) {
    case 'budget':
      return { category: context.category };
    case 'category':
      return { category: context.category };
    case 'merchant':
      return { search: context.merchant };
    case 'account':
      return { accountIds: [context.accountId] };
  }
}

function contextTitle(_context: TransactionListContext): string {
  return 'Transactions';
}

export function TransactionListPopover({ open, anchorRef, context, onRequestClose }: Props) {
  const { isMobile } = useViewportBreakpoint();
  const filters = contextToFilters(context);
  const title = contextTitle(context);

  const handleOpenInTransactions = () => {
    dispatchNavigateToTransactions(contextToNavigateDetail(context));
    onRequestClose();
  };

  const openInTransactionsButton = (
    <IconButton
      type="button"
      variant="ghost"
      size="sm"
      aria-label="Open in transactions"
      title="Open in transactions"
      onClick={handleOpenInTransactions}
      className={cn('shrink-0')}
    >
      <ArrowUpRight aria-hidden="true" />
    </IconButton>
  );

  const content = (
    <div
      data-testid="transaction-list-popover-content"
      className={cn(
        'flex',
        'flex-col',
        'min-h-0',
        'flex-1',
        'overflow-hidden',
        isMobile && 'h-[min(50dvh,32rem)]'
      )}
    >
      <section
        className={cn('flex', 'min-h-0', 'flex-1', 'flex-col', isMobile && 'px-5 pb-4 pt-5')}
      >
        <div className={cn('shrink-0')}>
          <ModalDrawerHeader
            closeWithDialog={isMobile}
            onClose={onRequestClose}
            closeLabel="Close transaction list"
          >
            <div className={cn('flex min-w-0 items-center gap-1')}>
              <p className={cn(modalDrawerSectionLabelClassName, 'min-w-0 truncate')}>{title}</p>
              {openInTransactionsButton}
            </div>
          </ModalDrawerHeader>
        </div>
        <div className={cn('relative min-h-0 flex-1 overflow-hidden')}>
          <VirtualizedTransactionList filters={filters} variant="contextual" />
        </div>
      </section>
    </div>
  );

  if (isMobile) {
    return (
      <Modal
        isOpen={open}
        onClose={onRequestClose}
        presentation="drawer"
        labelledBy="transaction-list-popover-title"
        description="Filtered transaction list"
        data-testid="transaction-list-popover-sheet"
        containerClassName={cn(
          'p-[env(safe-area-inset-top)_env(safe-area-inset-right)_env(safe-area-inset-bottom)_env(safe-area-inset-left)]'
        )}
        className={cn(
          'w-full',
          'max-w-none',
          'rounded-b-none',
          'rounded-t-[2rem]',
          ...floatingChromeGlass.shell,
          ...floatingChromeGlass.backdrop,
          'max-h-[min(50dvh,32rem)]',
          'overflow-hidden'
        )}
      >
        <h2 id="transaction-list-popover-title" className="sr-only">
          {title}
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
          data-testid="transaction-list-popover-popover"
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
            'flex',
            'flex-col',
            'w-[min(92vw,28rem)]',
            'min-w-[18rem]',
            'md:w-[min(32rem,calc(100vw-4rem))]',
            radius.standard,
            ...floatingChromeGlass.shell,
            ...floatingChromeGlass.backdrop,
            'p-4',
            'flex',
            'h-[min(50dvh,32rem)]',
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

export default TransactionListPopover;

function isDismissTargetWithinAnchor(
  anchorRef: RefObject<HTMLElement>,
  target: EventTarget | null
): boolean {
  return target instanceof Node && anchorRef.current != null && anchorRef.current.contains(target);
}
