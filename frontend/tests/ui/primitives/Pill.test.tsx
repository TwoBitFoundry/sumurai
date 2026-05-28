import { render, screen } from '@testing-library/react';
import { Pill } from '@/ui/primitives/Pill';

describe('Pill', () => {
  it('renders category pills without a leading dot', () => {
    render(
      <Pill categoryName="food_and_drink" accentIndexByName={new Map([['food_and_drink', 0]])}>
        Food & Drink
      </Pill>
    );

    const pill = screen.getByText('Food & Drink').closest('span');
    expect(pill).toBeInTheDocument();
    expect(pill?.querySelector('[aria-hidden="true"]')).toBeNull();
  });
});
