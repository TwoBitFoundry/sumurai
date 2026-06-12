import { useCallback, useLayoutEffect, useRef, useState } from 'react';

const RESIZE_DEBOUNCE_MS = 100;

type ChartContainerSize = {
  width: number;
  height: number;
};

export const useChartContainerSize = () => {
  const observerRef = useRef<ResizeObserver | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<ChartContainerSize>({ width: 0, height: 0 });

  const applySize = useCallback(() => {
    if (document.hidden) {
      return;
    }

    const node = nodeRef.current;
    if (!node) {
      return;
    }

    const { width, height } = node.getBoundingClientRect();
    const nextWidth = Math.floor(width);
    const nextHeight = Math.floor(height);
    if (nextWidth <= 0) {
      return;
    }

    setSize((current) => {
      const resolvedHeight = nextHeight > 0 ? nextHeight : current.height;
      if (current.width === nextWidth && current.height === resolvedHeight) {
        return current;
      }
      return { width: nextWidth, height: resolvedHeight };
    });
  }, []);

  const ref = useCallback(
    (node: HTMLDivElement | null) => {
      nodeRef.current = node;
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

      const debouncedUpdate = () => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
        timerRef.current = setTimeout(applySize, RESIZE_DEBOUNCE_MS);
      };

      applySize();
      const observer = new ResizeObserver(debouncedUpdate);
      observer.observe(node);
      observerRef.current = observer;
    },
    [applySize]
  );

  useLayoutEffect(() => {
    const onVisibilityChange = () => {
      if (!document.hidden) {
        requestAnimationFrame(applySize);
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      observerRef.current?.disconnect();
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [applySize]);

  return { ref, remeasure: applySize, ...size };
};
