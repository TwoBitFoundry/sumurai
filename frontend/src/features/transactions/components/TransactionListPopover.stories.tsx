import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useRef, useState } from 'react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { TransactionListContext } from '@/features/transactions/models/transactionWindow';
import { AccountFilterStoryProvider } from '@/storybook/AccountFilterStoryProvider';
import {
  getCursorStoryTransactions,
  storyProviderAccounts,
} from '@/storybook/screens/user-journeys/shared';
import {
  jsonResponse,
  route,
  type StoryApiRequest,
  StoryApiScope,
} from '@/storybook/screens/user-journeys/storyApi';
import { NAVIGATE_TO_TRANSACTIONS_EVENT, type NavigateToTransactionsDetail } from '@/utils/events';
import { TransactionListPopover } from './TransactionListPopover';

const storyInteractionTimeoutMs = 20_000;

function currentMonthDateRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

function parseStoryTransactionRequest(request: StoryApiRequest) {
  return {
    search: request.query.get('search'),
    categoryPrimary: request.query.get('category_primary'),
    merchant: request.query.get('merchant'),
    accountIds: request.query.getAll('account_ids[]'),
    startDate: request.query.get('start_date'),
    endDate: request.query.get('end_date'),
    cursor: request.query.get('cursor'),
    limit: Number(request.query.get('limit') ?? '40'),
  };
}

const storyTransactionHandlers = [
  route('GET', '/providers/accounts', () => jsonResponse(storyProviderAccounts)),
  route('GET', '/transactions', (request) =>
    jsonResponse(getCursorStoryTransactions(parseStoryTransactionRequest(request)))
  ),
];

function PopoverFixture({
  context,
  onRequestClose,
}: {
  context: TransactionListContext;
  onRequestClose?: () => void;
}) {
  const anchorRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="min-h-[36rem] p-8">
      <button ref={anchorRef} type="button" className="rounded-lg border px-4 py-2">
        Filter source
      </button>
      <TransactionListPopover
        open
        anchorRef={anchorRef}
        context={context}
        onRequestClose={onRequestClose ?? (() => {})}
      />
    </div>
  );
}

const meta = {
  title: 'Features/Transactions/TransactionListPopover',
  tags: ['autodocs', 'test'],
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <AccountFilterStoryProvider>
        <StoryApiScope handlers={storyTransactionHandlers}>
          <Story />
        </StoryApiScope>
      </AccountFilterStoryProvider>
    ),
  ],
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

async function expectPopoverReady(scope: ReturnType<typeof within>) {
  await waitFor(
    () => {
      expect(scope.getByTestId('transaction-list-popover-content')).toBeVisible();
      expect(scope.getByRole('region', { name: /transaction list/i })).toBeVisible();
    },
    { timeout: storyInteractionTimeoutMs }
  );
}

function storyScope(canvasElement: HTMLElement) {
  return within(canvasElement.ownerDocument.body);
}

export const CategoryFilter: Story = {
  render: () => <PopoverFixture context={{ type: 'category', category: 'food_and_drink' }} />,
  play: async ({ canvasElement }) => {
    const scope = storyScope(canvasElement);
    await expectPopoverReady(scope);
    await waitFor(
      () => {
        expect(scope.getByText(/grocery run/i)).toBeVisible();
        expect(scope.getByText(/sample market/i)).toBeVisible();
        expect(scope.queryByText(/transit tap/i)).not.toBeInTheDocument();
      },
      { timeout: storyInteractionTimeoutMs }
    );
  },
};

export const MerchantFilter: Story = {
  render: () => <PopoverFixture context={{ type: 'merchant', merchant: 'Grocery Run' }} />,
  play: async ({ canvasElement }) => {
    const scope = storyScope(canvasElement);
    await expectPopoverReady(scope);
    await waitFor(
      () => {
        expect(scope.getByText(/grocery run/i)).toBeVisible();
        expect(scope.queryByText(/sample market/i)).not.toBeInTheDocument();
        expect(scope.queryByText(/transit tap/i)).not.toBeInTheDocument();
      },
      { timeout: storyInteractionTimeoutMs }
    );
  },
};

export const AccountFilter: Story = {
  render: () => <PopoverFixture context={{ type: 'account', accountId: 'story-account-1' }} />,
  play: async ({ canvasElement }) => {
    const scope = storyScope(canvasElement);
    await expectPopoverReady(scope);
    await waitFor(
      () => {
        expect(scope.getByText(/grocery run/i)).toBeVisible();
        expect(scope.queryByText(/^payroll$/i)).not.toBeInTheDocument();
      },
      { timeout: storyInteractionTimeoutMs }
    );
  },
};

export const BudgetFilter: Story = {
  render: () => {
    const { startDate, endDate } = currentMonthDateRange();
    return (
      <PopoverFixture
        context={{
          type: 'budget',
          category: 'food_and_drink',
          startDate,
          endDate,
        }}
      />
    );
  },
  play: async ({ canvasElement }) => {
    const scope = storyScope(canvasElement);
    await expectPopoverReady(scope);
    await waitFor(
      () => {
        expect(scope.getByText(/grocery run/i)).toBeVisible();
        expect(scope.queryByText(/transit tap/i)).not.toBeInTheDocument();
      },
      { timeout: storyInteractionTimeoutMs }
    );
  },
};

export const OpenInTransactions: Story = {
  render: () => <PopoverFixture context={{ type: 'merchant', merchant: 'Grocery Run' }} />,
  play: async ({ canvasElement }) => {
    const scope = storyScope(canvasElement);
    await expectPopoverReady(scope);

    let detail: NavigateToTransactionsDetail | undefined;
    const handler = (event: Event) => {
      detail = (event as CustomEvent<NavigateToTransactionsDetail>).detail;
    };
    window.addEventListener(NAVIGATE_TO_TRANSACTIONS_EVENT, handler);

    try {
      await userEvent.click(scope.getByRole('button', { name: /open in transactions/i }));
      await waitFor(() => {
        expect(detail).toEqual({ search: 'Grocery Run' });
      });
    } finally {
      window.removeEventListener(NAVIGATE_TO_TRANSACTIONS_EVENT, handler);
    }
  },
};

export const ClosePopover: Story = {
  render: function ClosePopoverStory() {
    const anchorRef = useRef<HTMLButtonElement>(null);
    const [open, setOpen] = useState(true);

    return (
      <div className="min-h-[36rem] p-8">
        <button ref={anchorRef} type="button" className="rounded-lg border px-4 py-2">
          Filter source
        </button>
        <TransactionListPopover
          open={open}
          anchorRef={anchorRef}
          context={{ type: 'category', category: 'food_and_drink' }}
          onRequestClose={() => setOpen(false)}
        />
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const scope = storyScope(canvasElement);
    await expectPopoverReady(scope);
    await userEvent.click(scope.getByRole('button', { name: /close transaction list/i }));
    await waitFor(() => {
      expect(scope.queryByTestId('transaction-list-popover-content')).not.toBeInTheDocument();
    });
  },
};
