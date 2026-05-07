import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Building2, Clock } from 'lucide-react';
import { HeroStatCard } from './HeroStatCard';

const meta = {
  title: 'Components/HeroStatCard',
  component: HeroStatCard,
  tags: ['autodocs', 'test'],
  args: {
    index: 1,
    title: 'Active institutions',
    icon: <Building2 className="h-4 w-4" />,
    value: 2,
    suffix: 'out of 3',
    subtext: 'One needs attention',
  },
} satisfies Meta<typeof HeroStatCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LastSync: Story = {
  args: {
    index: 3,
    title: 'Last sync',
    icon: <Clock className="h-4 w-4" />,
    value: '8m ago',
    suffix: undefined,
    subtext: 'Balances refreshed automatically',
  },
};
