import {
  clampAnchoredPopoverPosition,
  resolveAnchoredPopoverWidth,
} from '@/utils/anchoredPopoverPosition';

describe('anchoredPopoverPosition', () => {
  it('resolves popover width within viewport padding', () => {
    expect(resolveAnchoredPopoverWidth(390)).toBe(320);
    expect(resolveAnchoredPopoverWidth(1280)).toBe(320);
    expect(resolveAnchoredPopoverWidth(280)).toBe(248);
  });

  it('clamps horizontal position when the anchor is near the viewport edge', () => {
    const position = clampAnchoredPopoverPosition({
      triggerRect: { left: 8, top: 900, width: 24, height: 24 },
      popoverWidth: 320,
      popoverHeight: 180,
      viewportWidth: 390,
      viewportHeight: 844,
    });

    expect(position.left).toBe(176);
  });

  it('clamps vertical position when the popover would extend above the viewport', () => {
    const position = clampAnchoredPopoverPosition({
      triggerRect: { left: 180, top: 40, width: 24, height: 24 },
      popoverWidth: 320,
      popoverHeight: 180,
      viewportWidth: 390,
      viewportHeight: 844,
    });

    expect(position.bottom).toBe(648);
  });
});
