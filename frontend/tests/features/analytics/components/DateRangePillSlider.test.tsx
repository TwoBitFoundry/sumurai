import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import {
  DateRangeLabelPill,
  DateRangePillSlider,
} from '@/features/analytics/components/DateRangePillSlider';
import { ControlTooltipProvider } from '@/ui/primitives/ControlHoverLabel';

function renderDateRangePillSlider(ui: React.ReactElement) {
  return render(<ControlTooltipProvider>{ui}</ControlTooltipProvider>);
}

const labelPillProps = {
  onChange: jest.fn(),
  onCustomDateRangeChange: jest.fn(),
  dateBounds: { start: '2026-01-01', end: '2026-06-21' },
};

function setupPickerWindow() {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: 1280,
  });
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    writable: true,
    value: 900,
  });
  window.dispatchEvent(new Event('resize'));
}

function openDateRangePicker() {
  const pill = screen.getByRole('button', { name: /selected date range:.*choose custom range/i });
  fireEvent.click(pill);
  return pill;
}

describe('DateRangePillSlider', () => {
  it('renders preset labels and calls onChange with the selected range', () => {
    const onChange = jest.fn();

    renderDateRangePillSlider(
      <DateRangePillSlider dateRange="current-month" onChange={onChange} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Since year start' }));

    expect(screen.getByRole('button', { name: 'Since this month' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Custom range' })).not.toBeInTheDocument();
    expect(onChange).toHaveBeenCalledWith('ytd');
  });

  it('uses stronger body text for the range labels', () => {
    renderDateRangePillSlider(
      <DateRangePillSlider dateRange="current-month" onChange={jest.fn()} />
    );

    expect(
      screen.getByRole('button', { name: 'Since this month' }).querySelector('.font-body-strong')
    ).not.toBeNull();
  });

  it('renders compact context pill tabs with a smaller corner radius', () => {
    renderDateRangePillSlider(
      <DateRangePillSlider dateRange="current-month" onChange={jest.fn()} />
    );

    const activeButton = screen.getByRole('button', { name: 'Since this month' });
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
});

describe('DateRangeLabelPill', () => {
  it('opens the custom date picker when the label pill is clicked', () => {
    renderDateRangePillSlider(<DateRangeLabelPill dateRange="current-month" {...labelPillProps} />);

    const pill = screen.getByRole('button', { name: /selected date range:.*choose custom range/i });

    fireEvent.click(pill);

    expect(screen.getByTestId('custom-date-range-picker-popover')).toBeInTheDocument();
    expect(screen.getByLabelText('Start date')).toBeInTheDocument();
    expect(screen.getByLabelText('End date')).toBeInTheDocument();

    fireEvent.click(pill);

    expect(screen.queryByTestId('custom-date-range-picker-popover')).not.toBeInTheDocument();
  });

  it('uses fog tint and primary text styling', () => {
    renderDateRangePillSlider(<DateRangeLabelPill dateRange="current-month" {...labelPillProps} />);

    const pill = screen.getByTestId('date-range-label-pill');
    expect(pill.className).toContain('brand-fog');
    expect(pill.className).not.toContain('sky-500');
    expect(pill.querySelector('span')?.className).toContain('--color-text-primary');
    expect(pill).toHaveTextContent(/\d/);
  });

  it('shows the active preset range in the label pill', () => {
    renderDateRangePillSlider(<DateRangeLabelPill dateRange="current-month" {...labelPillProps} />);

    expect(screen.getByRole('button', { name: /selected date range:/i })).not.toHaveTextContent(
      'Custom'
    );
  });

  it('shows the applied custom range in the label pill', () => {
    renderDateRangePillSlider(
      <DateRangeLabelPill
        dateRange="custom"
        customDateRange={{ start: '2026-01-01', end: '2026-03-15' }}
        {...labelPillProps}
      />
    );

    expect(screen.getByRole('button', { name: /selected date range:/i })).toHaveTextContent(
      'Jan 1, 2026 – Mar 15, 2026'
    );
    expect(screen.getByTestId('date-range-label-pill').className).toContain('ring-2');
    expect(screen.getByTestId('date-range-label-pill').className).toContain('ring-inset');
  });

  it('shows Custom before a custom range has been applied', () => {
    renderDateRangePillSlider(
      <DateRangeLabelPill dateRange="custom" customDateRange={null} {...labelPillProps} />
    );

    const pill = screen.getByRole('button', { name: /selected date range:/i });
    expect(pill).toHaveTextContent('Custom');
  });

  it('restores the preset range when the picker is dismissed without applying', () => {
    setupPickerWindow();
    const onChange = jest.fn();
    const onCustomDateRangeChange = jest.fn();

    renderDateRangePillSlider(
      <DateRangeLabelPill
        dateRange="current-month"
        onChange={onChange}
        onCustomDateRangeChange={onCustomDateRangeChange}
        dateBounds={labelPillProps.dateBounds}
      />
    );

    openDateRangePicker();
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '' } });
    fireEvent.mouseDown(document.body);

    expect(screen.queryByTestId('custom-date-range-picker-popover')).not.toBeInTheDocument();
    expect(onChange).toHaveBeenCalledWith('current-month');
    expect(onCustomDateRangeChange).not.toHaveBeenCalled();
  });

  it('restores the committed custom range when dismissed without applying', () => {
    setupPickerWindow();
    const onChange = jest.fn();
    const onCustomDateRangeChange = jest.fn();
    const customDateRange = { start: '2026-01-01', end: '2026-03-15' };

    renderDateRangePillSlider(
      <DateRangeLabelPill
        dateRange="custom"
        customDateRange={customDateRange}
        onChange={onChange}
        onCustomDateRangeChange={onCustomDateRangeChange}
        dateBounds={labelPillProps.dateBounds}
      />
    );

    openDateRangePicker();
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '' } });
    fireEvent.mouseDown(document.body);

    expect(onCustomDateRangeChange).toHaveBeenCalledWith(customDateRange);
    expect(onChange).toHaveBeenCalledWith('custom');
  });

  it('keeps the picker open after applying a custom range from a preset', () => {
    setupPickerWindow();
    const onChange = jest.fn();
    const onCustomDateRangeChange = jest.fn();

    const { rerender } = renderDateRangePillSlider(
      <DateRangeLabelPill
        dateRange="current-month"
        onChange={onChange}
        onCustomDateRangeChange={onCustomDateRangeChange}
        dateBounds={labelPillProps.dateBounds}
      />
    );

    openDateRangePicker();
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-02-01' } });
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-02-28' } });

    expect(screen.getByTestId('custom-date-range-picker-popover')).toBeInTheDocument();
    expect(onChange).toHaveBeenCalledWith('custom');
    expect(onCustomDateRangeChange).toHaveBeenCalledWith({
      start: '2026-02-01',
      end: '2026-02-28',
    });

    rerender(
      <ControlTooltipProvider>
        <DateRangeLabelPill
          dateRange="custom"
          customDateRange={{ start: '2026-02-01', end: '2026-02-28' }}
          onChange={onChange}
          onCustomDateRangeChange={onCustomDateRangeChange}
          dateBounds={labelPillProps.dateBounds}
        />
      </ControlTooltipProvider>
    );

    expect(screen.getByTestId('custom-date-range-picker-popover')).toBeInTheDocument();
  });

  it('keeps an applied custom range when dismissed after a later invalid edit', () => {
    setupPickerWindow();
    const onChange = jest.fn();
    const onCustomDateRangeChange = jest.fn();

    renderDateRangePillSlider(
      <DateRangeLabelPill
        dateRange="current-month"
        onChange={onChange}
        onCustomDateRangeChange={onCustomDateRangeChange}
        dateBounds={labelPillProps.dateBounds}
      />
    );

    openDateRangePicker();
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-02-01' } });
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-02-28' } });

    onChange.mockClear();
    onCustomDateRangeChange.mockClear();

    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '' } });
    fireEvent.mouseDown(document.body);

    expect(onChange).not.toHaveBeenCalled();
    expect(onCustomDateRangeChange).not.toHaveBeenCalled();
  });
});
