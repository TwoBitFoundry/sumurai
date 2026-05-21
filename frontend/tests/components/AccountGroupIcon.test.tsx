import { render } from '@testing-library/react';
import { AccountGroupIcon } from '@/components/AccountGroupIcon';

describe('AccountGroupIcon', () => {
  it('defers sizing to the parent icon well', () => {
    const { container } = render(<AccountGroupIcon group="cash" />);
    const iconClass = container.querySelector('svg')?.getAttribute('class') ?? '';
    expect(iconClass).toContain('shrink-0');
    expect(iconClass).not.toMatch(/\bh-[0-9]/);
  });
});
