import { render } from '@testing-library/react';
import { Select } from '@/ui/primitives/Select';

describe('Select', () => {
  it('renders the default variant with shared control tokens', () => {
    const { container } = render(<Select />);
    const select = container.querySelector('select');
    expect(select?.className).toContain('w-full');
    expect(select?.className).toContain('bg-white');
  });

  it('renders the glass variant with shared control tokens', () => {
    const { container } = render(<Select variant="glass" selectSize="lg" />);
    const select = container.querySelector('select');
    expect(select?.className).toContain('bg-white/80');
    expect(select?.className).toContain('py-3');
  });
});
