import { useCallback, useLayoutEffect, useRef, useState } from 'react';

const RESIZE_DEBOUNCE_MS = 100;

type ChartContainerSize = {
  width: number;
  height: number;
};

export const useChartContainerSize = () => {
  const observerRef = useRef<ResizeObserver | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [size, setSize] = useState<ChartContainerSize>({ width: 0, height: 0 });

  const ref = useCallback((node: HTMLDivElement | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (!node) {
      setSize({ width: 0, height: 0 });
      return;
    }

    const applySize = () => {
      const { width, height } = node.getBoundingClientRect();
      const nextWidth = Math.floor(width);
      const nextHeight = Math.floor(height);
      if (nextWidth <= 0 || nextHeight <= 0) return;
      setSize((current) =>
        current.width === nextWidth && current.height === nextHeight
          ? current
          : { width: nextWidth, height: nextHeight }
      );
    };

    const debouncedUpdate = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(applySize, RESIZE_DEBOUNCE_MS);
    };

    applySize();
    const observer = new ResizeObserver(debouncedUpdate);
    observer.observe(node);
    observerRef.current = observer;
  }, []);

  useLayoutEffect(() => {
    return () => {
      observerRef.current?.disconnect();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { ref, ...size };
};
