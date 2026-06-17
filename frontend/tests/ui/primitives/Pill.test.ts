import { buildPillScrollMask } from '@/ui/primitives/Pill';

describe('buildPillScrollMask', () => {
  it('returns undefined when no fades are needed', () => {
    expect(buildPillScrollMask(false, false)).toBeUndefined();
  });

  it('returns a right-edge mask when only the right fade is needed', () => {
    expect(buildPillScrollMask(false, true)).toContain('calc(100% - 2.5rem)');
  });

  it('returns a left-edge mask when only the left fade is needed', () => {
    expect(buildPillScrollMask(true, false)).toContain('transparent, black 2.5rem');
  });

  it('returns a dual-edge mask when both fades are needed', () => {
    const mask = buildPillScrollMask(true, true);
    expect(mask).toContain('transparent, black 2.5rem');
    expect(mask).toContain('calc(100% - 2.5rem), transparent');
  });
});
