import { computeDateRange } from '@/utils/dateRanges';

describe('computeDateRange', () => {
  it('computes current month range', () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const start = new Date(y, m, 1).toISOString().slice(0, 10);
    const end = new Date(y, m + 1, 0).toISOString().slice(0, 10);
    const r = computeDateRange('current-month');
    expect(r.start).toBe(start);
    expect(r.end).toBe(end);
  });

  it('computes past year range', () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const start = new Date(y, m - 11, 1).toISOString().slice(0, 10);
    const end = new Date(y, m + 1, 0).toISOString().slice(0, 10);
    const r = computeDateRange('past-year');
    expect(r.start).toBe(start);
    expect(r.end).toBe(end);
  });

  it('computes all-time limited to five years', () => {
    const now = new Date();
    const start = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate())
      .toISOString()
      .slice(0, 10);
    const end = now.toISOString().slice(0, 10);
    const r = computeDateRange('all-time');
    expect(r.start).toBe(start);
    expect(r.end).toBe(end);
  });
});
