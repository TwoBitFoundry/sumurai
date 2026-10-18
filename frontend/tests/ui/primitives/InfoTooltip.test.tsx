import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { InfoTooltip } from '@/ui/primitives/InfoTooltip';

describe('InfoTooltip', () => {
  it('renders trigger button with aria-label', () => {
    render(<InfoTooltip content="Helpful information" ariaLabel="Test info label" />);
    const button = screen.getByRole('button', { name: 'Test info label' });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('shows tooltip content on click', () => {
    render(<InfoTooltip content="Pending transactions explanation" />);
    const button = screen.getByRole('button');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    fireEvent.click(button);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    expect(screen.getByText('Pending transactions explanation')).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(button);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('shows tooltip content on mouse enter and hides on mouse leave', () => {
    jest.useFakeTimers();
    render(<InfoTooltip content="Hover explanation" />);
    const button = screen.getByRole('button');

    act(() => {
      fireEvent.mouseEnter(button);
    });
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    expect(screen.getByText('Hover explanation')).toBeInTheDocument();

    act(() => {
      fireEvent.mouseLeave(button);
      jest.advanceTimersByTime(200);
    });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    jest.useRealTimers();
  });
});
