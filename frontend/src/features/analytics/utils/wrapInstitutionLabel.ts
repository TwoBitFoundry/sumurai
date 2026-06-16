/**
 * Formats institution names for chart axis labels.
 */

export const INSTITUTION_LABEL_FONT_SIZE = 12;
export const INSTITUTION_LABEL_LINE_HEIGHT = 14;
export const INSTITUTION_LABEL_AXIS_GAP = 6;
export const INSTITUTION_LABEL_CHAR_WIDTH = INSTITUTION_LABEL_FONT_SIZE * 0.58;

export function maxCharsPerInstitutionSlot(barCount: number): number {
  if (barCount <= 1) return 18;
  if (barCount === 2) return 14;
  if (barCount === 3) return 12;
  if (barCount === 4) return 11;
  return Math.max(8, Math.floor(48 / barCount));
}

export function maxCharsPerInstitutionSlotForWidth(
  barCount: number,
  chartWidth: number,
  yAxisWidth: number,
  chartRightMargin = 16
): number {
  if (barCount <= 0) return maxCharsPerInstitutionSlot(0);
  if (chartWidth <= 0) return maxCharsPerInstitutionSlot(barCount);
  const slotWidth = Math.max(0, chartWidth - yAxisWidth - chartRightMargin) / barCount;
  const fromWidth = Math.floor(slotWidth / INSTITUTION_LABEL_CHAR_WIDTH);
  return Math.max(6, Math.min(24, fromWidth));
}

export function institutionLabelAxisHeight(maxLabelLines: number): number {
  return (
    INSTITUTION_LABEL_AXIS_GAP +
    Math.max(0, maxLabelLines - 1) * INSTITUTION_LABEL_LINE_HEIGHT +
    INSTITUTION_LABEL_FONT_SIZE +
    2
  );
}

export function wrapInstitutionLabel(label: string, maxCharsPerLine: number): string[] {
  const trimmed = label.trim();
  if (!trimmed) return [''];
  if (trimmed.length <= maxCharsPerLine) return [trimmed];

  const words = trimmed.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxCharsPerLine) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
    }

    if (word.length > maxCharsPerLine) {
      let chunk = '';
      for (const char of word) {
        const next = `${chunk}${char}`;
        if (next.length > maxCharsPerLine) {
          if (chunk) lines.push(chunk);
          chunk = char;
        } else {
          chunk = next;
        }
      }
      current = chunk;
    } else {
      current = word;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines.length > 0 ? lines : [trimmed];
}

export function institutionLabelLineCount(label: string, maxCharsPerLine: number): number {
  return wrapInstitutionLabel(label, maxCharsPerLine).length;
}
