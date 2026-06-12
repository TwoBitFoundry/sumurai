import { computeDateRange, formatDateRangeLabel } from '@/utils/dateRanges';

const localYmd = (d: Date) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

describe('computeDateRange', () => {
  it('computes current month as trailing 30 days', () => {
    const now = new Date();
    const end = localYmd(now);
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 29);
    const start = localYmd(startDate);
    const r = computeDateRange('current-month');
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
  });
});
