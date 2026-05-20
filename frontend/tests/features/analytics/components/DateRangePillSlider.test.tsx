import { fireEvent, render, screen } from '@testing-library/react';
import { DateRangePillSlider } from '@/features/analytics/components/DateRangePillSlider';

describe('DateRangePillSlider', () => {
  it('renders compact labels and calls onChange with the selected range', () => {
    const onChange = jest.fn();

    render(<DateRangePillSlider dateRange="current-month" onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: '1Y' }));

    expect(screen.getByRole('button', { name: '1M' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '5Y' })).toBeInTheDocument();
    expect(onChange).toHaveBeenCalledWith('past-year');
  });

  it('uses stronger body text for the range labels', () => {
    render(<DateRangePillSlider dateRange="current-month" onChange={jest.fn()} />);

    expect(screen.getByRole('button', { name: '1M' }).querySelector('.font-body-strong')).not.toBeNull();
  });
});
