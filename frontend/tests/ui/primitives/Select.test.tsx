import { render, screen } from '@testing-library/react';
import React from 'react';
import { Button } from '@/ui/primitives/Button';
import { Select } from '@/ui/primitives/Select';
import { control, radius as uiRadiusRecipes } from '@/ui/recipes';

describe('Select', () => {
  it.each([
    ['sm', control.height.sm, control.paddingX.sm, control.label.sm],
    ['md', control.height.md, control.paddingX.md, control.label.md],
    ['lg', control.height.lg, control.paddingX.lg, control.label.lg],
  ] as const)('renders the %s control size', (selectSize, height, paddingX, label) => {
    render(
      <Select aria-label="Category" selectSize={selectSize}>
        <option value="one">One</option>
      </Select>
    );

    const select = screen.getByRole('combobox', { name: 'Category' });
    expect(select.className).toContain(height);
    expect(select.className).toContain(paddingX);
    expect(select.className).toContain(label);
    expect(select.className).toContain(uiRadiusRecipes.standard);
  });

  it('shares the md height with Button md', () => {
    render(
      <div>
        <Button>Save</Button>
        <Select aria-label="Status" selectSize="md">
          <option value="open">Open</option>
        </Select>
      </div>
    );

    expect(screen.getByRole('button', { name: 'Save' }).className).toContain(control.height.md);
    expect(screen.getByRole('combobox', { name: 'Status' }).className).toContain(control.height.md);
  });
});
