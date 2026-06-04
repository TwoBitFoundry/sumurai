import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MenuDropdown, MenuItem } from '@/ui/primitives';

describe('MenuDropdown', () => {
  it('renders the menu in a portal so it can escape parent overflow', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <MenuDropdown trigger={<button type="button">Open</button>}>
        <MenuItem onClick={jest.fn()}>Export as CSV</MenuItem>
        <MenuItem onClick={jest.fn()}>Export as OFX</MenuItem>
      </MenuDropdown>
    );

    await user.click(screen.getByRole('button', { name: 'Open' }));

    const menu = screen.getByRole('menu');
    expect(container).not.toContainElement(menu);
    expect(document.body).toContainElement(menu);
    const csvItem = within(menu).getByRole('button', { name: 'Export as CSV' });
    expect(csvItem).toBeVisible();
    expect(csvItem).toHaveClass('bg-transparent');
    expect(csvItem).toHaveClass('border-transparent');
    expect(csvItem.className).toContain('hover:border-[var(--color-border-default)]');
    expect(csvItem.className).toContain('hover:bg-[var(--color-surface-hover-row)]');
  });
});
