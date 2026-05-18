import { gradientShellRecipes } from '@/ui/primitives/GradientShell';

describe('GradientShell', () => {
  it('keeps centered shell padding on the md tier', () => {
    expect(gradientShellRecipes.contentCentered).toContain('px-4');
    expect(gradientShellRecipes.contentCentered).toContain('md:px-6');
    expect(gradientShellRecipes.contentCentered).not.toContain('sm:px-6');
  });
});
