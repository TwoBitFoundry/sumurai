import { render } from '@testing-library/react';
import { Footer } from '@/components/Footer';

describe('Footer', () => {
  it('moves shell padding and footer layout to the md tier', () => {
    const { container, getByText, getByRole } = render(<Footer />);
    const footer = container.querySelector('footer');
    const shell = container.querySelector('footer > div');
    const bottomRow = container.querySelector('footer > div > div:last-child');

    expect(footer).toBeTruthy();
    expect(shell).toHaveClass('md:pl-[calc(2rem_+_env(safe-area-inset-left))]');
    expect(bottomRow).toHaveClass('md:flex-row');
    expect(bottomRow).toHaveClass('md:items-center');
    expect(bottomRow).toHaveClass('md:justify-between');
    expect(bottomRow).not.toHaveClass('sm:flex-row', 'sm:items-center', 'sm:justify-between');
    expect(getByText('Built in the open with the community')).toBeTruthy();
    expect(getByRole('link', { name: 'Contact' })).toBeTruthy();
  });
});
