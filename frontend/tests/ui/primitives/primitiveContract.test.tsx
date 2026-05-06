import { render, screen } from '@testing-library/react';
import { Button } from '@/ui/primitives/Button';
import { designTokens } from '@/ui/tokens';

const buttonVariants = [
  'primary',
  'secondary',
  'ghost',
  'icon',
  'tab',
  'tabActive',
  'danger',
  'success',
  'connect',
] as const;

describe('primitive contract', () => {
  it('keeps button variant keys aligned with the token recipe contract', () => {
    const tokenKeys = Object.keys(designTokens.components.button).filter((key) => key !== 'base');
    for (const key of buttonVariants) {
      expect(tokenKeys).toContain(key);
    }
  });

  it('renders each button variant without throwing', () => {
    for (const variant of buttonVariants) {
      const size = variant === 'icon' ? 'icon' : 'md';
      const { unmount } = render(
        <Button variant={variant} size={size}>
          {variant}
        </Button>
      );
      expect(screen.getByRole('button', { name: variant })).toBeInTheDocument();
      unmount();
    }
  });
});
