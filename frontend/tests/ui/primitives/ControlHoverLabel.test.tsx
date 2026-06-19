import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '@/ui/primitives/Button';
import { ControlTooltipProvider } from '@/ui/primitives/ControlHoverLabel';
import { IconButton } from '@/ui/primitives/IconButton';

describe('ControlHoverLabel', () => {
  it('shows a fast hover label for CTA buttons', async () => {
    const user = userEvent.setup();

    render(
      <ControlTooltipProvider>
        <Button variant="primary">Categorize</Button>
      </ControlTooltipProvider>
    );

    const button = screen.getByRole('button', { name: 'Categorize' });
    expect(button).not.toHaveAttribute('title');

    await user.hover(button);

    await waitFor(() => {
      expect(screen.getAllByText('Categorize').length).toBeGreaterThan(1);
    });
  });

  it('shows a fast hover label for secondary buttons', async () => {
    const user = userEvent.setup();

    render(
      <ControlTooltipProvider>
        <Button variant="secondary">Export</Button>
      </ControlTooltipProvider>
    );

    await user.hover(screen.getByRole('button', { name: 'Export' }));

    await waitFor(() => {
      expect(screen.getAllByText('Export').length).toBeGreaterThan(1);
    });
  });

  it('shows a fast hover label for icon buttons', async () => {
    const user = userEvent.setup();

    render(
      <ControlTooltipProvider>
        <IconButton aria-label="Categories">
          <span aria-hidden="true">T</span>
        </IconButton>
      </ControlTooltipProvider>
    );

    const button = screen.getByRole('button', { name: 'Categories' });
    expect(button).not.toHaveAttribute('title');

    await user.hover(button);

    await waitFor(() => {
      expect(screen.getAllByText('Categories').length).toBeGreaterThan(1);
    });
  });
});
