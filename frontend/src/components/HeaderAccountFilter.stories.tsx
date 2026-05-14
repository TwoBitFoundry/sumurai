import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { sampleAccounts } from '@/storybook/fixtures/accounts';
import {
  accountToProviderAccount,
  buildMockAccountFilterContext,
  MockAccountFilterProvider,
} from '@/storybook/mockAccountFilter';
import { HeaderAccountFilter } from './HeaderAccountFilter';

const providerAccounts = sampleAccounts.map(accountToProviderAccount);
const storyBank: Record<string, typeof providerAccounts> = {
  'Story Bank': providerAccounts,
};

const meta = {
  title: 'Components/HeaderAccountFilter',
  component: HeaderAccountFilter,
  tags: ['autodocs', 'test'],
  decorators: [
    (Story, context) => {
      const mock =
        (context.parameters.mockAccountFilter as ReturnType<
          typeof buildMockAccountFilterContext
        >) ??
        buildMockAccountFilterContext({
          accountsByBank: storyBank,
          selectedAccountIds: providerAccounts.map((a) => a.id),
        });
      return (
        <MockAccountFilterProvider value={mock}>
          <div className="flex justify-end px-4 py-6">
            <Story />
          </div>
        </MockAccountFilterProvider>
      );
    },
  ],
} satisfies Meta<typeof HeaderAccountFilter>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Filter: Story = {
  parameters: {
    mockAccountFilter: buildMockAccountFilterContext({
      accountsByBank: storyBank,
      selectedAccountIds: providerAccounts.map((a) => a.id),
    }),
  },
};

export const PartialSelection: Story = {
  parameters: {
    mockAccountFilter: buildMockAccountFilterContext({
      accountsByBank: storyBank,
      selectedAccountIds: [providerAccounts[0].id],
      isAllAccountsSelected: false,
    }),
  },
};

export const LoadingNoAccounts: Story = {
  parameters: {
    mockAccountFilter: buildMockAccountFilterContext({
      accountsByBank: {},
      allAccountIds: [],
      selectedAccountIds: [],
      loading: true,
    }),
  },
};
