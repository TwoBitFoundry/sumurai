import {
  clampCustomDateRangeBounds,
  computeDateRange,
  dateRangeDaySpan,
  defaultCustomDateRangeBounds,
  formatDateRangeLabel,
  isoDateToSliderOffset,
  isValidCustomDateRange,
  resolveDateRange,
  sliderOffsetToIsoDate,
  validateCustomDateRange,
} from '@/utils/dateRanges';

const localYmd = (d: Date) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

describe('computeDateRange', () => {
  it('computes current month since the first of the month through today', () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const start = localYmd(new Date(y, m, 1));
    const end = localYmd(now);
    const r = computeDateRange('current-month');
    expect(r.start).toBe(start);
    expect(r.end).toBe(end);
  });

  it('computes last month since the first of the prior month through today', () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const start = localYmd(new Date(y, m - 1, 1));
    const end = localYmd(now);
    const r = computeDateRange('last-month');
    expect(r.start).toBe(start);
    expect(r.end).toBe(end);
  });

  it('computes ytd since January 1 through today', () => {
    const now = new Date();
    const y = now.getFullYear();
    const start = localYmd(new Date(y, 0, 1));
    const end = localYmd(now);
    const r = computeDateRange('ytd');
    expect(r.start).toBe(start);
    expect(r.end).toBe(end);
  });

  it('computes past year range', () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const start = localYmd(new Date(y, m - 11, 1));
    const end = localYmd(new Date(y, m + 1, 0));
    const r = computeDateRange('past-year');
    expect(r.start).toBe(start);
    expect(r.end).toBe(end);
  });

  it('computes all-time limited to five years', () => {
    const now = new Date();
    const start = localYmd(new Date(now.getFullYear() - 5, now.getMonth(), now.getDate()));
    const end = localYmd(now);
    const r = computeDateRange('all-time');
    expect(r.start).toBe(start);
    expect(r.end).toBe(end);
  });
});

describe('formatDateRangeLabel', () => {
  it('formats a range with start and end dates', () => {
    const { start, end } = computeDateRange('current-month');
    const formatPart = (iso: string) => {
      const [year, month, day] = iso.split('-').map(Number);
      return new Date(year, month - 1, day).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    };

    expect(formatDateRangeLabel('current-month')).toBe(
      `${formatPart(start!)} – ${formatPart(end!)}`
    );
    expect(formatDateRangeLabel('custom')).toBe('Custom');
    expect(formatDateRangeLabel('custom', { start: '2026-01-01', end: '2026-01-31' })).toBe(
      'Jan 1, 2026 – Jan 31, 2026'
    );
  });
});

describe('resolveDateRange', () => {
  it('returns custom bounds when the key is custom', () => {
    expect(resolveDateRange('custom', { start: '2026-04-01', end: '2026-04-30' })).toEqual({
      start: '2026-04-01',
      end: '2026-04-30',
    });
  });

  it('returns empty bounds for custom without stored values', () => {
    expect(resolveDateRange('custom')).toEqual({});
  });

  it('uses fetched bounds for all-time', () => {
    expect(resolveDateRange('all-time', null, { start: '2022-03-11', end: '2026-06-21' })).toEqual({
      start: '2022-03-11',
      end: '2026-06-21',
    });
  });

  it('clamps preset ranges into the available bounds', () => {
    expect(resolveDateRange('past-year', null, { start: '2026-05-10', end: '2026-06-21' })).toEqual(
      {
        start: '2026-05-10',
        end: '2026-06-21',
      }
    );
  });
});

describe('validateCustomDateRange', () => {
  const bounds = { start: '2026-01-15', end: '2026-06-21' };

  it('rejects an end date after today', () => {
    expect(validateCustomDateRange('2026-01-16', '2902-01-01', bounds)).toBe(
      'End date cannot be after today.'
    );
    expect(isValidCustomDateRange('2026-01-16', '2902-01-01', bounds)).toBe(false);
  });

  it('rejects a start date after the end date', () => {
    expect(validateCustomDateRange('2026-02-15', '2026-01-31', bounds)).toBe(
      'Choose a start date on or before the end date.'
    );
  });

  it('rejects a start date before the earliest available date', () => {
    expect(validateCustomDateRange('2026-01-01', '2026-01-31', bounds)).toBe(
      'Start date cannot be before the earliest available date.'
    );
  });

  it('accepts a range ending today', () => {
    expect(validateCustomDateRange('2026-01-15', bounds.end, bounds)).toBeNull();
    expect(isValidCustomDateRange('2026-01-15', bounds.end, bounds)).toBe(true);
  });
});

describe('clampCustomDateRangeBounds', () => {
  it('clamps a range into the fetched bounds', () => {
    expect(
      clampCustomDateRangeBounds(
        { start: '2026-01-01', end: '2902-01-01' },
        { start: '2026-01-15', end: '2026-06-21' }
      )
    ).toEqual({
      start: '2026-01-15',
      end: '2026-06-21',
    });
  });
});

describe('defaultCustomDateRangeBounds', () => {
  it('defaults to the available bounds when history is shorter than thirty days', () => {
    expect(
      defaultCustomDateRangeBounds({
        start: '2026-06-10',
        end: '2026-06-21',
      })
    ).toEqual({
      start: '2026-06-10',
      end: '2026-06-21',
    });
  });
});

describe('slider date helpers', () => {
  const bounds = { start: '2026-06-10', end: '2026-06-21' };

  it('computes the inclusive day span', () => {
    expect(dateRangeDaySpan(bounds)).toBe(12);
  });

  it('maps between ISO dates and slider offsets', () => {
    expect(isoDateToSliderOffset('2026-06-15', bounds)).toBe(5);
    expect(sliderOffsetToIsoDate(5, bounds)).toBe('2026-06-15');
  });

  it('round-trips long ranges that cross daylight saving boundaries', () => {
    const longBounds = { start: '2025-01-14', end: '2026-06-20' };

    expect(isoDateToSliderOffset('2025-03-10', longBounds)).toBe(55);
    expect(sliderOffsetToIsoDate(55, longBounds)).toBe('2025-03-10');
    expect(isoDateToSliderOffset(longBounds.end, longBounds)).toBe(
      dateRangeDaySpan(longBounds) - 1
    );
  });
});
