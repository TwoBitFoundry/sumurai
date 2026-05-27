import { categoriesToDonut } from '@/features/analytics/adapters/chartData';
import { categoryAccents } from '@/ui/tokens';

describe('categoriesToDonut', () => {
  it('assigns stable category colors from the accent index map', () => {
    const accentIndexByName = new Map([
      ['Merch', 0],
      ['Services', 1],
      ['Food & Drink', 2],
    ]);

    const result = categoriesToDonut(
      [
        { category: 'GENERAL_MERCHANDISE', amount: 2368.1 },
        { category: 'GENERAL_SERVICES', amount: 2293.57 },
        { category: 'FOOD_AND_DRINK', amount: 1142.81 },
      ],
      accentIndexByName
    );

    expect(result).toEqual([
      {
        name: 'Merch',
        value: 2368.1,
        color: categoryAccents[0].ringHex,
      },
      {
        name: 'Services',
        value: 2293.57,
        color: categoryAccents[1].ringHex,
      },
      {
        name: 'Food & Drink',
        value: 1142.81,
        color: categoryAccents[2].ringHex,
      },
    ]);
  });
});
