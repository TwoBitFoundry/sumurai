import { designTokens } from '@/ui/tokens';
import generatedTokens from '@/ui/tokens/generated/tokens';

const expectedRoles = [
  'primary',
  'body',
  'muted',
  'subtle',
  'label',
  'inverse',
  'accent',
  'danger',
  'success',
  'warning',
  'info',
];

const expectedColorTokens = expectedRoles.map((role) => `text-${role}`);

describe('design token text recipes', () => {
  it('exposes the semantic text roles', () => {
    expect(Object.keys(designTokens.text)).toEqual(expect.arrayContaining(expectedRoles));
  });

  it('keeps the semantic text roles backed by generated color tokens', () => {
    expect(Object.keys(generatedTokens.color)).toEqual(expect.arrayContaining(expectedColorTokens));
  });

  it('maps representative text roles to paired light and dark classes', () => {
    expect(designTokens.text.primary).toBe(
      `text-[${generatedTokens.color['text-primary'].$value.hex}] dark:text-[${generatedTokens.color['text-primary-dark'].$value.hex}]`
    );
    expect(designTokens.text.body).toBe(
      `text-[${generatedTokens.color['text-body'].$value.hex}] dark:text-[${generatedTokens.color['text-body-dark'].$value.hex}]`
    );
    expect(designTokens.text.danger).toBe(
      `text-[${generatedTokens.color['text-danger'].$value.hex}] dark:text-[${generatedTokens.color['text-danger-dark'].$value.hex}]`
    );
  });
});
