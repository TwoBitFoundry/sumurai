import { pageLayoutRecipes } from '@/layouts/PageLayout';

describe('PageLayout', () => {
  it('keeps the shell spacing on the base, md, and lg tiers', () => {
    const shell = pageLayoutRecipes.shell.join(' ');

    expect(shell).toContain('p-4');
    expect(shell).toContain('md:p-8');
    expect(shell).toContain('lg:p-8');
    expect(shell).not.toContain('sm:p-8');
    expect(shell).not.toContain('xl:');
    expect(shell).not.toContain('2xl:');
  });
});
