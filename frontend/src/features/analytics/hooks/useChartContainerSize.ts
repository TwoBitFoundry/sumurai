import { useLayoutEffect, useRef, useState } from 'react';

type ChartContainerSize = {
  width: number;
  height: number;
};

export const useChartContainerSize = (deps: unknown[] = []) => {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<ChartContainerSize>({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;

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
    return () => observer.disconnect();
  }, deps);

  return { ref, ...size };
};
