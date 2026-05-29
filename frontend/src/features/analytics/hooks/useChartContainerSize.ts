import { useCallback, useLayoutEffect, useRef, useState } from 'react';

type ChartContainerSize = {
  width: number;
  height: number;
};

export const useChartContainerSize = () => {
  const observerRef = useRef<ResizeObserver | null>(null);
  const [size, setSize] = useState<ChartContainerSize>({ width: 0, height: 0 });

  const ref = useCallback((node: HTMLDivElement | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;

    if (!node) {
      setSize({ width: 0, height: 0 });
      return;
    }

    const updateSize = () => {
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

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(node);
    observerRef.current = observer;
  }, []);

  useLayoutEffect(() => {
    return () => observerRef.current?.disconnect();
  }, []);

  return { ref, ...size };
};
