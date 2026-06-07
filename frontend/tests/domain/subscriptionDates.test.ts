import {
  computeSubscriptionNextDueDate,
  formatSubscriptionDateLabel,
  formatSubscriptionDateRangeLabel,
  getSubscriptionDateRangeDisplay,
} from '@/domain/subscriptionDates';

const june2026 = new Date('2026-06-01T12:00:00');

describe('subscriptionDates', () => {
  it('formats subscription dates with month and ordinal day, omitting the current year', () => {
    expect(formatSubscriptionDateLabel('2026-02-15', june2026)).toBe('Feb, 15th');
    expect(formatSubscriptionDateLabel('2026-06-01', june2026)).toBe('Jun, 1st');
    expect(formatSubscriptionDateLabel('2026-03-11', june2026)).toBe('Mar, 11th');
    expect(formatSubscriptionDateLabel('2026-03-22', june2026)).toBe('Mar, 22nd');
  });

  it('shows a short year when the date is outside the current year', () => {
    expect(formatSubscriptionDateLabel('2025-02-15', june2026)).toBe("Feb, 15th '25");
    expect(formatSubscriptionDateLabel('2027-02-15', june2026)).toBe("Feb, 15th '27");
  });

  it('computes the next due date after the last charge for monthly subscriptions', () => {
    expect(
      computeSubscriptionNextDueDate('2026-02-15', 'monthly', new Date('2026-02-20T12:00:00'))
    ).toBe('2026-03-15');
    expect(
      computeSubscriptionNextDueDate('2026-05-15', 'monthly', new Date('2026-06-01T12:00:00'))
    ).toBe('2026-06-15');
    expect(
      computeSubscriptionNextDueDate('2026-01-31', 'monthly', new Date('2026-02-01T12:00:00'))
    ).toBe('2026-02-28');
    expect(
      computeSubscriptionNextDueDate('2026-01-31', 'monthly', new Date('2026-03-01T12:00:00'))
    ).toBe('2026-03-31');
  });

  it('computes the next due date for quarterly and annual subscriptions', () => {
    expect(
      computeSubscriptionNextDueDate('2026-02-15', 'quarterly', new Date('2026-03-01T12:00:00'))
    ).toBe('2026-05-15');
    expect(
      computeSubscriptionNextDueDate('2025-02-15', 'annual', new Date('2026-01-01T12:00:00'))
    ).toBe('2026-02-15');
  });

  it('formats the since and next due date range label', () => {
    expect(
      formatSubscriptionDateRangeLabel(
        {
          first_charged: '2026-02-15',
          last_charged: '2026-05-15',
          cadence: 'monthly',
          occurrence_count: 4,
        },
        june2026
      )
    ).toBe('Feb, 15th to Jun, 15th');
    expect(
      getSubscriptionDateRangeDisplay(
        {
          first_charged: '2026-02-15',
          last_charged: '2026-05-15',
          cadence: 'monthly',
          occurrence_count: 4,
        },
        june2026
      )
    ).toEqual({
      since: 'Feb, 15th',
      nextDue: 'Jun, 15th',
    });
  });

  it('shows only the next due date when multiple charges share the same month as the last charge', () => {
    expect(
      formatSubscriptionDateRangeLabel(
        {
          first_charged: '2026-06-01',
          last_charged: '2026-06-01',
          cadence: 'monthly',
          occurrence_count: 3,
        },
        june2026
      )
    ).toBe('Jul, 1st');
  });

  it('shows the start and next due dates for a single charge when the next due is in a later month', () => {
    expect(
      formatSubscriptionDateRangeLabel(
        {
          first_charged: '2026-06-01',
          last_charged: '2026-06-01',
          cadence: 'monthly',
          occurrence_count: 1,
        },
        june2026
      )
    ).toBe('Jun, 1st to Jul, 1st');
    expect(
      getSubscriptionDateRangeDisplay(
        {
          first_charged: '2026-06-01',
          last_charged: '2026-06-01',
          cadence: 'monthly',
          occurrence_count: 1,
        },
        june2026
      )
    ).toEqual({
      since: 'Jun, 1st',
      nextDue: 'Jul, 1st',
    });
  });
});
