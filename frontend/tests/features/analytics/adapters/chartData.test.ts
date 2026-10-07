import { categoriesToDonut } from '@/features/analytics/adapters/chartData';

describe('chartData adapters', () => {
  it('combines categories that format to the same display name', () => {
    expect(
      categoriesToDonut([
        { name: 'Credit card bills', value: '2228.69' },
        { name: 'Credit Card Bills', value: 614.39 },
        { name: 'GENERAL_MERCHANDISE', value: 25 },
      ])
    ).toEqual([
      { name: 'Credit Card Bills', value: 2843.08 },
      { name: 'Shopping', value: 25 },
    ]);
  });
});
