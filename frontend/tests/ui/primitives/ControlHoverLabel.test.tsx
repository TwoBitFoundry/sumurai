import { createEvent, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

  it('keeps disabled full-width buttons stretched in their container', () => {
    render(
      <ControlTooltipProvider>
        <Button variant="primary" className="w-full" disabled>
          Enter
        </Button>
      </ControlTooltipProvider>
    );

    const button = screen.getByRole('button', { name: 'Enter' });
    const wrapper = button.parentElement;

    expect(wrapper?.tagName).toBe('SPAN');
    expect(wrapper).toHaveClass('w-full');
    expect(wrapper).toHaveClass('justify-center');
  });

  it('does not keep the hover label open after click', async () => {
    const user = userEvent.setup();

    render(
      <ControlTooltipProvider>
        <Button variant="connect">Link Account</Button>
      </ControlTooltipProvider>
    );

    await user.click(screen.getByRole('button', { name: 'Link Account' }));

    expect(screen.getAllByText('Link Account')).toHaveLength(1);
  });

  it('does not prevent default on pointer down for wrapped buttons', () => {
    render(
      <ControlTooltipProvider>
        <Button variant="connect">Link Account</Button>
      </ControlTooltipProvider>
    );

    const button = screen.getByRole('button', { name: 'Link Account' });
    const event = createEvent.pointerDown(button);

    fireEvent(button, event);

    expect(event.defaultPrevented).toBe(false);
  });

  it('keeps the hover label visible while the pointer remains on the trigger', async () => {
    const user = userEvent.setup();

    render(
      <ControlTooltipProvider>
        <Button variant="connect">Link Account</Button>
      </ControlTooltipProvider>
    );

    await user.hover(screen.getByRole('button', { name: 'Link Account' }));

    await waitFor(() => {
      expect(screen.getAllByText('Link Account').length).toBeGreaterThan(1);
    });

    await new Promise((resolve) => setTimeout(resolve, 250));

    expect(screen.getAllByText('Link Account').length).toBeGreaterThan(1);
  });
});
