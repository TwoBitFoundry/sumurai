import { render, screen } from '@testing-library/react';
import React from 'react';
import { Button } from '@/ui/primitives/Button';
import { control, font } from '@/ui/recipes';

describe('Button', () => {
  it('defaults to the md control size', () => {
    render(<Button>Save</Button>);

    const button = screen.getByRole('button', { name: 'Save' });
    expect(button.className).toContain(control.height.md);
    expect(button.className).toContain(control.paddingX.md);
    expect(button.className).toContain(font.bodyStrong);
  });

  it.each([
    ['sm', control.height.sm, control.paddingX.sm, font.captionStrong],
    ['md', control.height.md, control.paddingX.md, font.bodyStrong],
    ['lg', control.height.lg, control.paddingX.lg, font.bodyStrong],
  ] as const)('renders the %s control size', (_, height, paddingX, label) => {
    render(<Button size={_}>Submit</Button>);

    const button = screen.getByRole('button', { name: 'Submit' });
    expect(button.className).toContain(height);
    expect(button.className).toContain(paddingX);
    expect(button.className).toContain(label);
  });

  it('renders square controls with the shared square recipe', () => {
    render(
      <Button size="md" shape="square">
        Edit
      </Button>
    );

    const button = screen.getByRole('button', { name: 'Edit' });
    expect(button.className).toContain(control.square.md);
  });
});
