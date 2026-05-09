import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Button } from './Button';

const meta = {
  title: 'Primitives/Button',
  component: Button,
  tags: ['autodocs', 'test'],
  args: {
    children: 'Continue',
    variant: 'primary',
    size: 'md',
    disabled: false,
    loading: false,
    onClick: fn(),
  },
  argTypes: {
    variant: {
      control: 'select',
      options: [
        'primary',
        'secondary',
        'ghost',
        'icon',
        'tab',
        'tabActive',
        'danger',
        'success',
        'connect',
      ],
    },
    size: {
      control: 'select',
      options: ['xs', 'sm', 'titleBarExpanded', 'md', 'lg', 'icon'],
    },
  },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {};

export const PrimaryInteraction: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /continue/i }));
    await expect(args.onClick).toHaveBeenCalled();
  },
};

export const Secondary: Story = {
  args: { variant: 'secondary' },
};

export const Disabled: Story = {
  args: { disabled: true },
};

export const Loading: Story = {
  args: { loading: true },
};

export const Connect: Story = {
  args: { variant: 'connect', children: 'Connect accounts' },
};

export const DarkPrimary: Story = {
  decorators: [
    (StoryEl) => (
      <div className="dark min-h-[120px] bg-slate-950 p-8">
        <StoryEl />
      </div>
    ),
  ],
};
