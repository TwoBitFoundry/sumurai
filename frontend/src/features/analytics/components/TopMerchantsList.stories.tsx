import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { sampleTopMerchants } from '@/storybook/fixtures/analytics';
import { TopMerchantsList } from './TopMerchantsList';

const meta = {
  title: 'Features/Analytics/TopMerchantsList',
  component: TopMerchantsList,
  tags: ['autodocs', 'test'],
  args: {
    merchants: sampleTopMerchants,
  },
} satisfies Meta<typeof TopMerchantsList>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: {
    merchants: [],
  },
};
