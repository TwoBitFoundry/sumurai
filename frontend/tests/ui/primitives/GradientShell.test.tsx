import { render } from '@testing-library/react';
import { GradientShell } from '@/ui/primitives/GradientShell';

describe('GradientShell', () => {
  describe('centering', () => {
    it('renders centered shell correctly', () => {
      const { container } = render(<GradientShell centered>Content</GradientShell>);
      const shell = container.firstChild as HTMLElement;
      expect(shell?.className).toMatchSnapshot();
    });

    it('renders default shell correctly', () => {
      const { container } = render(<GradientShell>Content</GradientShell>);
      const shell = container.firstChild as HTMLElement;
      expect(shell?.className).toMatchSnapshot();
    });
  });

  describe('default props', () => {
    it('uses non-centered layout by default', () => {
      const { container } = render(<GradientShell>Content</GradientShell>);
      const shell = container.firstChild as HTMLElement;
      expect(shell?.className).toContain('min-h-screen');
    });
  });

  describe('custom className', () => {
    it('merges custom className with variant classes', () => {
      const { container } = render(<GradientShell className="custom-class">Content</GradientShell>);
      const shell = container.firstChild as HTMLElement;
      expect(shell?.className).toContain('custom-class');
    });
  });

  describe('structure', () => {
    it('renders aura background elements', () => {
      const { container } = render(<GradientShell>Content</GradientShell>);
      const auras = container.querySelectorAll('.pointer-events-none');
      expect(auras.length).toBeGreaterThan(0);
    });

    it('renders content wrapper', () => {
      const { getByText } = render(<GradientShell>Test Content</GradientShell>);
      expect(getByText('Test Content')).toBeTruthy();
    });
  });
});
