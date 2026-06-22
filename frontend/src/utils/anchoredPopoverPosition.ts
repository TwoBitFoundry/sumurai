export type AnchoredPopoverPosition = {
  bottom: number;
  left: number;
};

export const ANCHORED_POPOVER_GAP_PX = 8;
export const ANCHORED_POPOVER_VIEWPORT_PADDING_PX = 16;
export const ANCHORED_POPOVER_MAX_WIDTH_PX = 320;

export function resolveAnchoredPopoverWidth(
  viewportWidth: number,
  maxWidthPx = ANCHORED_POPOVER_MAX_WIDTH_PX,
  paddingPx = ANCHORED_POPOVER_VIEWPORT_PADDING_PX
): number {
  return Math.min(viewportWidth - paddingPx * 2, maxWidthPx);
}

export function clampAnchoredPopoverPosition({
  triggerRect,
  popoverWidth,
  popoverHeight,
  viewportWidth,
  viewportHeight,
  gapPx = ANCHORED_POPOVER_GAP_PX,
  paddingPx = ANCHORED_POPOVER_VIEWPORT_PADDING_PX,
}: {
  triggerRect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>;
  popoverWidth: number;
  popoverHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  gapPx?: number;
  paddingPx?: number;
}): AnchoredPopoverPosition {
  const idealLeft = triggerRect.left + triggerRect.width / 2;
  const halfWidth = popoverWidth / 2;
  const minLeft = paddingPx + halfWidth;
  const maxLeft = viewportWidth - paddingPx - halfWidth;
  const left = Math.min(Math.max(idealLeft, minLeft), maxLeft);

  let bottom = viewportHeight - triggerRect.top + gapPx;
  const maxBottom = viewportHeight - paddingPx - popoverHeight;
  bottom = Math.min(bottom, maxBottom);

  return { bottom, left };
}
