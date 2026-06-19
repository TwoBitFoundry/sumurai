import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import {
  DateRangeLabelPill,
  DateRangePillSlider,
} from '@/features/analytics/components/DateRangePillSlider';
import { ControlTooltipProvider } from '@/ui/primitives/ControlHoverLabel';
import { formatDateRangeLabel } from '@/utils/dateRanges';

function renderDateRangePillSlider(ui: React.ReactElement) {
  return render(<ControlTooltipProvider>{ui}</ControlTooltipProvider>);
}

describe('DateRangePillSlider', () => {
  it('renders compact labels and calls onChange with the selected range', () => {
    const onChange = jest.fn();

    renderDateRangePillSlider(
      <DateRangePillSlider dateRange="current-month" onChange={onChange} />
    );

    fireEvent.click(screen.getByRole('button', { name: '1 year' }));

    expect(screen.getByRole('button', { name: '1 month' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '5 year' })).toBeInTheDocument();
    expect(onChange).toHaveBeenCalledWith('past-year');
  });

  it('uses stronger body text for the range labels', () => {
    renderDateRangePillSlider(
      <DateRangePillSlider dateRange="current-month" onChange={jest.fn()} />
    );

    expect(
      screen.getByRole('button', { name: '1 month' }).querySelector('.font-body-strong')
    ).not.toBeNull();
  });

  it('renders compact context pill tabs with a smaller corner radius', () => {
    renderDateRangePillSlider(
      <DateRangePillSlider dateRange="current-month" onChange={jest.fn()} />
    );

    const activeButton = screen.getByRole('button', { name: '1 month' });
    expect(activeButton.className).toContain('rounded-lg');
    expect(activeButton.className).not.toContain('flex-1');
    expect(activeButton.className).not.toContain('aspect-square');
    expect(activeButton.className).not.toContain('radius-standard');
  });

  it('constrains the pill shell so it can shrink beside the account filter', () => {
    renderDateRangePillSlider(
      <DateRangePillSlider dateRange="current-month" onChange={jest.fn()} />
    );

    const shell = screen.getByTestId('date-range-pill-slider');
    expect(shell.className).toContain('min-w-0');
    expect(shell.className).toContain('w-fit');
    expect(shell.className).toContain('max-w-full');
    expect(shell.className).toContain('overflow-x-auto');
  });

  it('shows the selected date range in a non-interactive pill', () => {
    render(<DateRangeLabelPill dateRange="current-month" />);

    expect(screen.getByLabelText(/selected date range:/i)).toHaveTextContent(
      formatDateRangeLabel('current-month')
    );
  });
});
