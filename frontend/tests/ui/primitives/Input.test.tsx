import { render, screen } from '@testing-library/react';
import React from 'react';
import { Button } from '@/ui/primitives/Button';
import { Input } from '@/ui/primitives/Input';
import { control, radius as uiRadiusRecipes } from '@/ui/recipes';

describe('Input', () => {
  it.each([
    ['sm', control.height.sm, control.paddingX.sm, control.label.sm],
    ['md', control.height.md, control.paddingX.md, control.label.md],
    ['lg', control.height.lg, control.paddingX.lg, control.label.lg],
  ] as const)('renders the %s control size', (inputSize, height, paddingX, label) => {
    render(<Input aria-label="Email" inputSize={inputSize} />);

    const input = screen.getByRole('textbox', { name: 'Email' });
    expect(input.className).toContain(height);
    expect(input.className).toContain(paddingX);
    expect(input.className).toContain(label);
    expect(input.className).toContain(uiRadiusRecipes.standard);
  });

  it('shares the md height with Button md', () => {
    render(
      <div>
        <Button>Save</Button>
        <Input aria-label="Search" inputSize="md" />
      </div>
    );

    expect(screen.getByRole('button', { name: 'Save' }).className).toContain(control.height.md);
    expect(screen.getByRole('textbox', { name: 'Search' }).className).toContain(control.height.md);
  });

  it('renders the floating chrome invalid variant with the floating surface and danger ring', () => {
    render(<Input aria-label="Category" variant="floatingChromeInvalid" />);

    const input = screen.getByRole('textbox', { name: 'Category' });
    expect(input.className).toContain(
      'bg-[color:color-mix(in_srgb,var(--color-surface-glass-panel)_26%,transparent)]'
    );
    expect(input.className).toContain('border-[var(--color-status-danger-border)]');
    expect(input.className).toContain('focus-visible:ring-inset');
  });
});
