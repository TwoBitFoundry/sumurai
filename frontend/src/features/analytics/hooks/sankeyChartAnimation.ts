export const SANKEY_ANIMATION_MS = 800;

export function easeOutCubic(progress: number) {
  const t = Math.min(1, Math.max(0, progress));
  return 1 - (1 - t) ** 3;
}

export function interpolateNumbers(
  from: Readonly<Record<string, number>>,
  to: Readonly<Record<string, number>>,
  keys: readonly string[],
  progress: number
) {
  const eased = easeOutCubic(progress);
  const result: Record<string, number> = {};
  for (const key of keys) {
    result[key] = from[key] + (to[key] - from[key]) * eased;
  }
  return result;
}

const LAYOUT_EPSILON = 0.5;

export function numbersMatch(
  left: Readonly<Record<string, number>>,
  right: Readonly<Record<string, number>>,
  keys: readonly string[]
) {
  return keys.every((key) => Math.abs(left[key] - right[key]) < LAYOUT_EPSILON);
}

export const sankeyNodeAnimationKeys = ['x', 'y', 'width', 'height'] as const;

export const sankeyLinkAnimationKeys = [
  'sourceX',
  'sourceY',
  'sourceControlX',
  'targetX',
  'targetY',
  'targetControlX',
  'linkWidth',
] as const;
