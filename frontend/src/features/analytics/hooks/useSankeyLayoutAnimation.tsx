import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  interpolateNumbers,
  numbersMatch,
  SANKEY_ANIMATION_MS,
  sankeyLinkAnimationKeys,
  sankeyNodeAnimationKeys,
} from './sankeyChartAnimation';

type LayoutFrame = Record<string, number>;
type EntityRegistration = { frame: LayoutFrame; keys: readonly string[] };

type SankeyAnimationContextValue = {
  registerScalar: (
    entityId: string,
    prop: string,
    target: number,
    keys: readonly string[]
  ) => number;
};

const SankeyAnimationContext = createContext<SankeyAnimationContextValue | null>(null);

export function SankeyAnimationProvider({ children }: { children: ReactNode }) {
  const [, setTick] = useState(0);
  const pendingRef = useRef<Map<string, EntityRegistration>>(new Map());
  const committedRef = useRef<Map<string, EntityRegistration>>(new Map());
  const displayRef = useRef<Map<string, LayoutFrame>>(new Map());
  const animatingRef = useRef(false);
  const rafRef = useRef(0);

  const registerScalar = useCallback(
    (entityId: string, prop: string, target: number, keys: readonly string[]) => {
      const pending = pendingRef.current.get(entityId);
      pendingRef.current.set(entityId, {
        frame: { ...(pending?.frame ?? {}), [prop]: target },
        keys,
      });
      return displayRef.current.get(entityId)?.[prop] ?? target;
    },
    []
  );

  useLayoutEffect(() => {
    const pending = pendingRef.current;
    pendingRef.current = new Map();

    if (pending.size === 0) {
      return;
    }

    let shouldAnimate = false;
    const nextCommitted = new Map(committedRef.current);

    for (const [entityId, registration] of pending) {
      const previous = committedRef.current.get(entityId);
      if (!previous) {
        displayRef.current.set(entityId, { ...registration.frame });
        nextCommitted.set(entityId, {
          frame: { ...registration.frame },
          keys: registration.keys,
        });
        continue;
      }

      if (!numbersMatch(previous.frame, registration.frame, registration.keys)) {
        shouldAnimate = true;
      }

      nextCommitted.set(entityId, {
        frame: { ...registration.frame },
        keys: registration.keys,
      });
    }

    committedRef.current = nextCommitted;

    if (!shouldAnimate) {
      if (!animatingRef.current) {
        for (const [entityId, { frame }] of nextCommitted) {
          displayRef.current.set(entityId, { ...frame });
        }
      }
      return;
    }

    const fromFrames = new Map<string, LayoutFrame>();
    const toFrames = new Map<string, LayoutFrame>();

    for (const [entityId, { frame, keys }] of nextCommitted) {
      const displayed = displayRef.current.get(entityId) ?? frame;
      const fromFrame: LayoutFrame = {};
      const toFrame: LayoutFrame = {};

      for (const key of keys) {
        fromFrame[key] = displayed[key] ?? frame[key];
        toFrame[key] = frame[key];
      }

      fromFrames.set(entityId, fromFrame);
      toFrames.set(entityId, toFrame);
    }

    animatingRef.current = true;
    cancelAnimationFrame(rafRef.current);
    const startedAt = performance.now();

    const step = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / SANKEY_ANIMATION_MS);

      for (const [entityId, toFrame] of toFrames) {
        const fromFrame = fromFrames.get(entityId);
        const keys = nextCommitted.get(entityId)?.keys;
        if (!fromFrame || !keys) {
          continue;
        }
        displayRef.current.set(entityId, interpolateNumbers(fromFrame, toFrame, keys, progress));
      }

      setTick((tick) => tick + 1);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        animatingRef.current = false;
      }
    };

    rafRef.current = requestAnimationFrame(step);
  });

  useLayoutEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      animatingRef.current = false;
    };
  }, []);

  return (
    <SankeyAnimationContext.Provider value={{ registerScalar }}>
      {children}
    </SankeyAnimationContext.Provider>
  );
}

export function useSankeyNodeScalar(entityId: string, prop: string, target: number) {
  const context = useContext(SankeyAnimationContext);
  if (!context) {
    return target;
  }
  return context.registerScalar(entityId, prop, target, sankeyNodeAnimationKeys);
}

export function useSankeyLinkScalar(entityId: string, prop: string, target: number) {
  const context = useContext(SankeyAnimationContext);
  if (!context) {
    return target;
  }
  return context.registerScalar(entityId, prop, target, sankeyLinkAnimationKeys);
}

export function useSankeyLinkPath(
  linkId: string,
  layout: {
    sourceX: number;
    sourceY: number;
    sourceControlX: number;
    targetX: number;
    targetY: number;
    targetControlX: number;
  }
) {
  const sourceX = useSankeyLinkScalar(linkId, 'sourceX', layout.sourceX);
  const sourceY = useSankeyLinkScalar(linkId, 'sourceY', layout.sourceY);
  const sourceControlX = useSankeyLinkScalar(linkId, 'sourceControlX', layout.sourceControlX);
  const targetX = useSankeyLinkScalar(linkId, 'targetX', layout.targetX);
  const targetY = useSankeyLinkScalar(linkId, 'targetY', layout.targetY);
  const targetControlX = useSankeyLinkScalar(linkId, 'targetControlX', layout.targetControlX);

  return `M${sourceX},${sourceY} C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`;
}
