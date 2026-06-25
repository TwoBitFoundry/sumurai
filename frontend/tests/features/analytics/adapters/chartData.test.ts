import { categoriesToDonut } from '@/features/analytics/adapters/chartData';
import { getTagThemeForCategory } from '@/utils/categories';

describe('categoriesToDonut', () => {
  it('assigns stable category colors from the accent index map', () => {
    const accentIndexByName = new Map([
      ['GENERAL_MERCHANDISE', 0],
      ['GENERAL_SERVICES', 1],
      ['FOOD_AND_DRINK', 2],
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
        name: 'Merchandise',
        categoryKey: 'GENERAL_MERCHANDISE',
        value: 2368.1,
        color: getTagThemeForCategory('GENERAL_MERCHANDISE', accentIndexByName).ringHex,
      },
      {
        name: 'Services',
        categoryKey: 'GENERAL_SERVICES',
        value: 2293.57,
        color: getTagThemeForCategory('GENERAL_SERVICES', accentIndexByName).ringHex,
      },
      {
        name: 'Food & Drink',
        categoryKey: 'FOOD_AND_DRINK',
        value: 1142.81,
        color: getTagThemeForCategory('FOOD_AND_DRINK', accentIndexByName).ringHex,
      },
    ]);
  });
});
