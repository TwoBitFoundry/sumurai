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

    const actionButtons = getByRole('link', { name: /forge with us/i }).parentElement;
    expect(actionButtons).toHaveClass('flex-row');
    expect(actionButtons).toHaveClass('flex-nowrap');
    expect(actionButtons).not.toHaveClass('flex-col');
    expect(getByRole('link', { name: /^github$/i })).toBeTruthy();
  });
});
