import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { createRef } from 'react';
import { CustomDateRangePicker } from '@/features/analytics/components/CustomDateRangePicker';

function renderCustomDateRangePicker(
  props: Omit<ComponentProps<typeof CustomDateRangePicker>, 'anchorRef'>
) {
  const anchorRef = createRef<HTMLButtonElement>();

  const view = render(
    <>
      <button ref={anchorRef} type="button">
        Anchor
      </button>
      <CustomDateRangePicker anchorRef={anchorRef} {...props} />
    </>
  );

  const anchor = screen.getByRole('button', { name: 'Anchor' });
  anchor.getBoundingClientRect = () => ({
    top: 700,
    left: 300,
    width: 137,
    height: 36,
    bottom: 736,
    right: 437,
    x: 300,
    y: 700,
    toJSON: () => ({}),
  });

  return view;
}

describe('CustomDateRangePicker', () => {
  beforeEach(() => {
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
  });

  it('renders start and end date inputs in a popover', () => {
    renderCustomDateRangePicker({
      open: true,
      value: { start: '2026-01-01', end: '2026-01-31' },
      onApply: jest.fn(),
      onRequestClose: jest.fn(),
    });

    expect(screen.getByTestId('custom-date-range-picker-popover')).toBeInTheDocument();
    expect(screen.getByLabelText('Start date')).toHaveValue('2026-01-01');
    expect(screen.getByLabelText('End date')).toHaveValue('2026-01-31');
  });

  it('applies a valid custom range in real time', () => {
    const onApply = jest.fn();
    const onRequestClose = jest.fn();

    renderCustomDateRangePicker({
      open: true,
      value: { start: '2026-01-01', end: '2026-01-31' },
      onApply,
      onRequestClose,
    });

    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-02-01' } });
    expect(onApply).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-02-28' } });
    expect(onApply).toHaveBeenLastCalledWith({ start: '2026-02-01', end: '2026-02-28' });
    expect(onRequestClose).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('button', { name: 'Apply custom date range' })
    ).not.toBeInTheDocument();
  });

  it('shows validation when the start date is after the end date', () => {
    renderCustomDateRangePicker({
      open: true,
      value: { start: '2026-01-01', end: '2026-01-31' },
      onApply: jest.fn(),
      onRequestClose: jest.fn(),
    });

    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-02-15' } });

    expect(screen.getByText('Choose a start date on or before the end date.')).toBeInTheDocument();
  });

  it('does not apply an end date after today', () => {
    const onApply = jest.fn();

    renderCustomDateRangePicker({
      open: true,
      value: { start: '2026-01-01', end: '2026-01-31' },
      onApply,
      onRequestClose: jest.fn(),
    });

    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2902-01-01' } });

    expect(onApply).not.toHaveBeenCalled();
    expect(screen.getByText('End date cannot be after today.')).toBeInTheDocument();
  });

  it('caps the end date input at today', () => {
    renderCustomDateRangePicker({
      open: true,
      value: { start: '2026-01-01', end: '2026-01-31' },
      onApply: jest.fn(),
      onRequestClose: jest.fn(),
    });

    const today = new Date();
    const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    expect(screen.getByLabelText('End date')).toHaveAttribute('max', todayIso);
    expect(screen.getByLabelText('Start date')).toHaveAttribute('max', todayIso);
  });
});
