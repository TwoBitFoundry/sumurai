import { render } from '@testing-library/react';
import { Footer } from '@/components/Footer';

describe('Footer', () => {
  it('moves shell padding and footer layout to the md tier', () => {
    const { container, getByText, getByRole } = render(<Footer />);
    const footer = container.querySelector('footer');
    const shell = container.querySelector('footer > div');
    const bottomRow = container.querySelector('footer > div > div:last-child');

    expect(footer).toBeTruthy();
    expect(shell).toHaveClass('max-w-[var(--spacing-content-max)]');
    expect(shell).toHaveClass('md:pl-[calc(2rem_+_env(safe-area-inset-left))]');
    expect(bottomRow).toHaveClass('flex-row');
    expect(bottomRow).toHaveClass('items-center');
    expect(bottomRow).toHaveClass('justify-between');
    expect(getByText('Forging better systems for founders')).toBeTruthy();
    expect(getByRole('link', { name: 'Contact' })).toBeTruthy();

    const actionButtons = getByRole('link', { name: /contribute/i }).parentElement;
    expect(actionButtons).toHaveClass('flex-row');
    expect(actionButtons).toHaveClass('flex-wrap');
    expect(actionButtons).toHaveClass('overflow-visible');
    expect(actionButtons).toHaveClass('md:flex-nowrap');
    expect(actionButtons).not.toHaveClass('flex-col');
    expect(getByRole('link', { name: /^github$/i })).toBeTruthy();
    expect(getByRole('link', { name: /contribute/i }).className).toContain(
      '--color-effect-accent-outline-glow'
    );
    expect(getByRole('link', { name: /contribute/i }).className).toContain('--color-brand-azure');
    expect(getByRole('link', { name: /buy us a coffee/i }).className).toContain(
      '--color-effect-warning-glow'
    );
    expect(getByRole('link', { name: /buy us a coffee/i }).className).toContain(
      '--color-brand-amber'
    );
    expect(getByRole('link', { name: /contribute/i }).className).toContain(
      'drop-shadow-[0_0_12px_var(--color-effect-accent-outline-glow)]'
    );
    expect(getByRole('link', { name: /buy us a coffee/i }).className).toContain(
      'drop-shadow-[0_0_12px_var(--color-effect-warning-glow)]'
    );
    expect(getByRole('link', { name: /^github$/i }).className).not.toContain(
      'drop-shadow-[0_0_12px'
    );
    expect(getByRole('link', { name: /^github$/i }).className).toContain('--color-border-control');
    for (const name of [/contribute/i, /buy us a coffee/i, /^github$/i]) {
      expect(getByRole('link', { name }).className).toContain('hover:-translate-y-0.5');
      expect(getByRole('link', { name }).className).toContain('active:scale-[0.98]');
    }
  });
});
