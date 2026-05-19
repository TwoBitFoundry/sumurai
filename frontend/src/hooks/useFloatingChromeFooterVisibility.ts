import { useCallback, useEffect, useState } from 'react';
import { useDebouncedValue } from './useDebouncedValue';

const DEFAULT_BOTTOM_INSET_PX = 92;
const MEASURE_DEBOUNCE_MS = 150;
const ROOT_MARGIN_DEBOUNCE_MS = 150;
const VISIBILITY_DEBOUNCE_MS = 120;

function measureFloatingChromeInset(chromeEl: HTMLElement): number {
  const rect = chromeEl.getBoundingClientRect();
  return Math.max(0, Math.ceil(window.innerHeight - rect.top));
}

function buildRootMargin(bottomInsetPx: number): string {
  return `0px 0px -${bottomInsetPx}px 0px`;
}

export function useFloatingChromeFooterVisibility(enabled: boolean) {
  const [chromeNode, setChromeNode] = useState<HTMLElement | null>(null);
  const [sentinelNode, setSentinelNode] = useState<HTMLElement | null>(null);
  const [floatingVisible, setFloatingVisible] = useState(true);
  const [bottomInsetPx, setBottomInsetPx] = useState(DEFAULT_BOTTOM_INSET_PX);
  const debouncedBottomInsetPx = useDebouncedValue(bottomInsetPx, ROOT_MARGIN_DEBOUNCE_MS);

  const floatingChromeRef = useCallback((node: HTMLElement | null) => {
    setChromeNode(node);
  }, []);

  const footerSentinelRef = useCallback((node: HTMLElement | null) => {
    setSentinelNode(node);
  }, []);

  useEffect(() => {
    if (!chromeNode) {
      return;
    }

    let measureTimer: ReturnType<typeof setTimeout> | undefined;

    const updateInset = () => {
      const next = measureFloatingChromeInset(chromeNode);
      setBottomInsetPx((current) => (current === next ? current : next));
    };

    const scheduleInsetUpdate = () => {
      if (measureTimer) {
        clearTimeout(measureTimer);
      }
      measureTimer = setTimeout(updateInset, MEASURE_DEBOUNCE_MS);
    };

    updateInset();
    const resizeObserver = new ResizeObserver(scheduleInsetUpdate);
    resizeObserver.observe(chromeNode);
    window.addEventListener('resize', scheduleInsetUpdate);

    return () => {
      if (measureTimer) {
        clearTimeout(measureTimer);
      }
      resizeObserver.disconnect();
      window.removeEventListener('resize', scheduleInsetUpdate);
    };
  }, [chromeNode]);

  useEffect(() => {
    if (!enabled) {
      setFloatingVisible(true);
      return;
    }
    if (!sentinelNode) {
      return;
    }

    const rootMargin = buildRootMargin(debouncedBottomInsetPx);
    let visibilityTimer: ReturnType<typeof setTimeout> | undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const intersecting = entries.some((entry) => entry.isIntersecting);
        if (visibilityTimer) {
          clearTimeout(visibilityTimer);
        }
        visibilityTimer = setTimeout(() => {
          setFloatingVisible(!intersecting);
        }, VISIBILITY_DEBOUNCE_MS);
      },
      { threshold: 0, rootMargin }
    );

    observer.observe(sentinelNode);
    return () => {
      if (visibilityTimer) {
        clearTimeout(visibilityTimer);
      }
      observer.disconnect();
    };
  }, [enabled, sentinelNode, debouncedBottomInsetPx]);

  return { floatingVisible, floatingChromeRef, footerSentinelRef };
}
