import { render, screen } from '@testing-library/react';
import { Card } from '@/components/ui/Card';

describe('Card', () => {
  it('renders children', () => {
    render(
      <Card>
        <span data-testid="kid">hello</span>
      </Card>
    );
    expect(screen.getByTestId('kid')).toHaveTextContent('hello');
  });

  it('merges className', () => {
    render(<Card className="foo">child</Card>);
    const el = screen.getByText('child').closest('div');
    expect(el?.className || '').toMatch(/foo/);
  });
});
