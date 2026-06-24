import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, within } from 'storybook/test';
import { AppFooter } from './AppFooter';

const meta = {
  title: 'Primitives/AppFooter',
  component: AppFooter,
  tags: ['autodocs', 'test'],
} satisfies Meta<typeof AppFooter>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('link', { name: /contribute/i }).className).toContain(
      '--color-effect-accent-outline-glow'
    );
    await expect(canvas.getByRole('link', { name: /buy us a coffee/i }).className).toContain(
      '--color-effect-warning-glow'
    );
    for (const name of [/contribute/i, /buy us a coffee/i, /^github$/i]) {
      await expect(canvas.getByRole('link', { name }).className).toContain(
        'hover:-translate-y-0.5'
      );
    }
  },
};

export const DarkCanvas: Story = {
  decorators: [
    (StoryEl) => (
      <div className="dark min-h-[260px] bg-[var(--color-brand-navy)]">
        <StoryEl />
      </div>
    ),
  ],
};
