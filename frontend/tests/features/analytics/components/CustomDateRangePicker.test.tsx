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

function formatDateLabel(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

describe('CustomDateRangePicker', () => {
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const bounds = { start: '2026-01-01', end: todayIso };

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
      bounds,
      value: { start: '2026-01-01', end: '2026-01-31' },
      onApply: jest.fn(),
      onRequestClose: jest.fn(),
    });

    expect(screen.getByTestId('custom-date-range-picker-popover')).toBeInTheDocument();
    expect(screen.getByLabelText('Start date')).toHaveValue('2026-01-01');
    expect(screen.getByLabelText('End date')).toHaveValue('2026-01-31');
    expect(screen.getByTestId('custom-date-range-picker-bounds')).toHaveTextContent(
      formatDateLabel(bounds.start)
    );
    expect(screen.getByTestId('custom-date-range-picker-bounds')).toHaveTextContent(
      formatDateLabel(bounds.end)
    );
  });

  it('applies a valid custom range in real time', () => {
    const onApply = jest.fn();
    const onRequestClose = jest.fn();

    renderCustomDateRangePicker({
      open: true,
      bounds,
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

  it('keeps the slider and fallback inputs in sync', () => {
    const onApply = jest.fn();

    renderCustomDateRangePicker({
      open: true,
      bounds,
      value: { start: '2026-01-01', end: '2026-01-31' },
      onApply,
      onRequestClose: jest.fn(),
    });

    const startSlider = screen.getByRole('slider', { name: 'Start date slider' });
    startSlider.focus();
    for (let index = 0; index < 9; index += 1) {
      fireEvent.keyDown(startSlider, { key: 'ArrowRight' });
    }

    expect(screen.getByLabelText('Start date')).toHaveValue('2026-01-10');
    expect(onApply).toHaveBeenLastCalledWith({ start: '2026-01-10', end: '2026-01-31' });

    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-01-20' } });

    expect(screen.getByRole('slider', { name: 'End date slider' })).toHaveAttribute(
      'aria-valuenow',
      '19'
    );
    expect(onApply).toHaveBeenLastCalledWith({ start: '2026-01-10', end: '2026-01-20' });
  });

  it('commits the updated end date without changing the start date', () => {
    const onApply = jest.fn();

    renderCustomDateRangePicker({
      open: true,
      bounds,
      value: { start: '2026-01-10', end: '2026-01-31' },
      onApply,
      onRequestClose: jest.fn(),
    });

    const endSlider = screen.getByRole('slider', { name: 'End date slider' });
    endSlider.focus();
    fireEvent.keyDown(endSlider, { key: 'PageUp' });

    expect(screen.getByLabelText('Start date')).toHaveValue('2026-01-10');
    expect(screen.getByLabelText('End date')).toHaveValue('2026-02-10');
    expect(onApply).toHaveBeenLastCalledWith({ start: '2026-01-10', end: '2026-02-10' });
  });

  it('preserves the draft range across parent rerenders while open', () => {
    const onApply = jest.fn();
    const anchorRef = createRef<HTMLButtonElement>();

    const { rerender } = render(
      <>
        <button ref={anchorRef} type="button">
          Anchor
        </button>
        <CustomDateRangePicker
          anchorRef={anchorRef}
          open
          bounds={bounds}
          value={{ start: '2026-01-01', end: '2026-01-31' }}
          onApply={onApply}
          onRequestClose={jest.fn()}
        />
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

    window.dispatchEvent(new Event('resize'));

    const endSlider = screen.getByRole('slider', { name: 'End date slider' });
    endSlider.focus();
    fireEvent.keyDown(endSlider, { key: 'PageUp' });

    expect(screen.getByLabelText('End date')).toHaveValue('2026-02-10');

    rerender(
      <>
        <button ref={anchorRef} type="button">
          Anchor
        </button>
        <CustomDateRangePicker
          anchorRef={anchorRef}
          open
          bounds={{ ...bounds }}
          value={{ start: '2026-01-01', end: '2026-01-31' }}
          onApply={onApply}
          onRequestClose={jest.fn()}
        />
      </>
    );

    expect(screen.getByLabelText('Start date')).toHaveValue('2026-01-01');
    expect(screen.getByLabelText('End date')).toHaveValue('2026-02-10');
  });

  it('shows validation when the start date is after the end date', () => {
    renderCustomDateRangePicker({
      open: true,
      bounds,
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
      bounds,
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
      bounds,
      value: { start: '2026-01-01', end: '2026-01-31' },
      onApply: jest.fn(),
      onRequestClose: jest.fn(),
    });

    expect(screen.getByLabelText('End date')).toHaveAttribute('max', todayIso);
    expect(screen.getByLabelText('Start date')).toHaveAttribute('max', todayIso);
    expect(screen.getByLabelText('Start date')).toHaveAttribute('min', '2026-01-01');
    expect(screen.getByLabelText('End date')).toHaveAttribute('min', '2026-01-01');
  });

  it('shows an unavailable state when no date bounds exist', () => {
    renderCustomDateRangePicker({
      open: true,
      bounds: null,
      value: null,
      onApply: jest.fn(),
      onRequestClose: jest.fn(),
    });

    expect(screen.getByText('Custom range')).toBeInTheDocument();
    expect(
      screen.getByText('No dated transactions are available for this account selection.')
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Start date')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('End date')).not.toBeInTheDocument();
  });
});
