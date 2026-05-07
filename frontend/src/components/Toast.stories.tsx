import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Toast } from './Toast';

const meta = {
  title: 'Components/Toast',
  component: Toast,
  tags: ['autodocs'],
  args: {
    message: 'Budget saved for Food.',
    onClose: () => {},
  },
  decorators: [
    (Story) => (
      <div className="relative min-h-[200px] w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Toast>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
