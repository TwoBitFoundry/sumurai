import { render, screen } from '@testing-library/react';
import { Amount } from '@/components/Amount';
import { text as uiTextRecipes } from '@/ui/recipes';

describe('Amount', () => {
  it('uses semantic text roles for positive amounts', () => {
    render(<Amount value={1250.5} />);

    expect(screen.getByText('$1,250.50')).toHaveClass(uiTextRecipes.success);
  });

  it('uses semantic text roles for negative amounts', () => {
    render(<Amount value={-45.25} />);

    expect(screen.getByText('-$45.25')).toHaveClass(uiTextRecipes.danger);
  });
});
