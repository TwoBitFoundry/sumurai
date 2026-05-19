import { render, screen } from '@testing-library/react';
import { WelcomeStep } from '@/components/onboarding/WelcomeStep';

describe('WelcomeStep', () => {
  it('uses the md tier for the onboarding preview and feature grids', () => {
    const { container } = render(<WelcomeStep />);

    expect(container.firstElementChild).toHaveClass('md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]');
    expect(container.querySelector('div.grid.gap-3')).toHaveClass('md:grid-cols-3');
    expect(screen.getByAltText('Sumurai dashboard preview').parentElement).toHaveClass(
      'md:aspect-[18/10]'
    );
  });
});
