import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { STORY_FIXED_ISO } from '@/storybook/fixtures/time';
import { jsonResponse, route, StoryApiScope } from '@/storybook/screens/user-journeys/storyApi';
import type { CursorTransactionsResponse, Transaction } from '@/types/api';
import { VirtualizedTransactionList } from './VirtualizedTransactionList';

const categories = [
  'food_and_drink',
  'transportation',
  'income',
  'entertainment',
  'bills_and_utilities',
  'health_and_wellness',
  'shopping',
  'travel',
];

function makeTx(id: string, overrides: Partial<Transaction> = {}): Transaction {
  return {
    id,
    date: STORY_FIXED_ISO,
    name: `Merchant ${id}`,
    merchant: `Merchant ${id}`,
    amount: -(Math.round(Math.random() * 9000) / 100 + 1),
    category: { primary: categories[Number(id.slice(-1)) % categories.length] ?? 'food_and_drink' },
    provider: 'plaid',
    account_name: 'Checking',
    account_type: 'depository',
    account_mask: '1234',
    ...overrides,
  };
}

const PAGE_SIZE = 20;

function makePageOf(count: number, offset: number, hasMore: boolean): CursorTransactionsResponse {
  const transactions = Array.from({ length: count }, (_, i) => makeTx(String(offset + i)));
  const last = transactions.at(-1);
  const first = transactions[0];
  return {
    transactions,
    next_cursor: hasMore && last ? `cursor:${last.id}` : null,
    prev_cursor: first ? `cursor:${first.id}` : null,
    has_more: hasMore,
  };
}

const FIRST_PAGE = makePageOf(PAGE_SIZE, 0, true);
const SECOND_PAGE = makePageOf(PAGE_SIZE, PAGE_SIZE, false);

const CATEGORIES_RESPONSE = categories;

function withApiScope(handlers: Parameters<typeof StoryApiScope>[0]['handlers'], Story: React.FC) {
  return (
    <StoryApiScope handlers={handlers}>
      <Story />
    </StoryApiScope>
  );
}

const meta = {
  title: 'Features/Transactions/VirtualizedTransactionList',
  component: VirtualizedTransactionList,
  tags: ['autodocs', 'test'],
  args: {
    filters: {},
    variant: 'page',
  },
  decorators: [
    (Story, ctx) => {
      const handlers = ctx.parameters.handlers ?? [];
      return withApiScope(handlers, Story);
    },
  ],
} satisfies Meta<typeof VirtualizedTransactionList>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  parameters: {
    handlers: [
      route('GET', '/transactions', () => jsonResponse(makePageOf(0, 0, false))),
      route('GET', '/transactions/categories', () => jsonResponse(CATEGORIES_RESPONSE)),
      route('GET', '/accounts', () => jsonResponse([])),
    ],
  },
};

export const SinglePage: Story = {
  parameters: {
    handlers: [
      route('GET', '/transactions', () => jsonResponse(makePageOf(8, 0, false))),
      route('GET', '/transactions/categories', () => jsonResponse(CATEGORIES_RESPONSE)),
      route('GET', '/accounts', () => jsonResponse([])),
    ],
  },
};

export const TwoPages: Story = {
  parameters: {
    handlers: [
      route('GET', '/transactions', (req) => {
        const cursor = req.query.get('cursor');
        return jsonResponse(cursor ? SECOND_PAGE : FIRST_PAGE);
      }),
      route('GET', '/transactions/categories', () => jsonResponse(CATEGORIES_RESPONSE)),
      route('GET', '/accounts', () => jsonResponse([])),
    ],
  },
};

export const ContextualVariant: Story = {
  args: {
    variant: 'contextual',
    filters: { merchant: 'Coffee Shop' },
  },
  parameters: {
    handlers: [
      route('GET', '/transactions', () => jsonResponse(makePageOf(5, 0, false))),
      route('GET', '/transactions/categories', () => jsonResponse(CATEGORIES_RESPONSE)),
      route('GET', '/accounts', () => jsonResponse([])),
    ],
  },
};

export const ManyRows: Story = {
  args: {
    filters: {},
  },
  parameters: {
    handlers: [
      route('GET', '/transactions', (req) => {
        const cursor = req.query.get('cursor');
        const offset = cursor ? parseInt(cursor.replace('cursor:', ''), 10) : 0;
        const isLast = offset >= 60;
        return jsonResponse(makePageOf(PAGE_SIZE, offset, !isLast));
      }),
      route('GET', '/transactions/categories', () => jsonResponse(CATEGORIES_RESPONSE)),
      route('GET', '/accounts', () => jsonResponse([])),
    ],
  },
};

export const DenseMerchantLabel: Story = {
  parameters: {
    handlers: [
      route('GET', '/transactions', () =>
        jsonResponse(
          makePageOf(1, 0, false) && {
            transactions: [
              makeTx('dense', {
                name: 'International Artisan Coffee Roasters Collective Wholesale Market LLC',
                merchant: 'International Artisan Coffee Roasters Collective Wholesale Market LLC',
                amount: -12.34,
                account_name: 'Premium Rewards Checking Account With Extended Name',
              }),
            ],
            next_cursor: null,
            prev_cursor: null,
            has_more: false,
          }
        )
      ),
      route('GET', '/transactions/categories', () => jsonResponse(CATEGORIES_RESPONSE)),
      route('GET', '/accounts', () => jsonResponse([])),
    ],
  },
};
