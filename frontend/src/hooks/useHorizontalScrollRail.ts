import { type RefObject, useCallback, useEffect, useRef } from 'react';

export const HORIZONTAL_SCROLL_RAIL_STEP_PX = 480;
const HORIZONTAL_SCROLL_RAIL_HOVER_PX_PER_MS = 0.35;

export function useHorizontalScrollRail(
  scrollRef: RefObject<HTMLDivElement | null>,
  onScrollChange?: () => void
) {
  const hoverFrameRef = useRef<number | null>(null);
  const hoverDirectionRef = useRef<-1 | 0 | 1>(0);
  const lastFrameTimeRef = useRef(0);

  const stopHoverScroll = useCallback(() => {
    hoverDirectionRef.current = 0;
    if (hoverFrameRef.current != null) {
      cancelAnimationFrame(hoverFrameRef.current);
      hoverFrameRef.current = null;
    }
  }, []);

  const scrollByAmount = useCallback(
    (direction: -1 | 1, behavior: ScrollBehavior = 'smooth') => {
      const el = scrollRef.current;
      if (!el) {
        return;
      }

      el.scrollBy({ left: direction * HORIZONTAL_SCROLL_RAIL_STEP_PX, behavior });
      onScrollChange?.();
    },
    [scrollRef, onScrollChange]
  );

  const startHoverScroll = useCallback(
    (direction: -1 | 1) => {
      stopHoverScroll();
      hoverDirectionRef.current = direction;
      lastFrameTimeRef.current = performance.now();

      const tick = (now: number) => {
        if (hoverDirectionRef.current !== direction) {
          return;
        }

        const el = scrollRef.current;
        if (!el) {
          stopHoverScroll();
          return;
        }

        const deltaMs = now - lastFrameTimeRef.current;
        lastFrameTimeRef.current = now;
        const distance = deltaMs * HORIZONTAL_SCROLL_RAIL_HOVER_PX_PER_MS;
        const maxScrollLeft = Math.max(0, el.scrollWidth - el.clientWidth);
        const nextScrollLeft = el.scrollLeft + direction * distance;

        if (direction < 0 && nextScrollLeft <= 0) {
          el.scrollLeft = 0;
          stopHoverScroll();
          onScrollChange?.();
          return;
        }

        if (direction > 0 && nextScrollLeft >= maxScrollLeft) {
          el.scrollLeft = maxScrollLeft;
          stopHoverScroll();
          onScrollChange?.();
          return;
        }

        el.scrollLeft = nextScrollLeft;
        onScrollChange?.();
        hoverFrameRef.current = requestAnimationFrame(tick);
      };

      hoverFrameRef.current = requestAnimationFrame(tick);
    },
    [scrollRef, onScrollChange, stopHoverScroll]
  );

  useEffect(() => () => stopHoverScroll(), [stopHoverScroll]);

  return {
    scrollByAmount,
    startHoverScroll,
    stopHoverScroll,
  };
}
