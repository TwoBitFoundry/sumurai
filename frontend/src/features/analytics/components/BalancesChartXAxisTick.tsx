import {
  INSTITUTION_LABEL_AXIS_GAP,
  INSTITUTION_LABEL_FONT_SIZE,
  INSTITUTION_LABEL_LINE_HEIGHT,
  wrapInstitutionLabel,
} from '../utils/wrapInstitutionLabel';

type BalancesChartXAxisTickProps = {
  x?: number | string;
  y?: number | string;
  payload?: { value: string };
  fill?: string;
  maxCharsPerLine: number;
};

export function BalancesChartXAxisTick({
  x = 0,
  y = 0,
  payload,
  fill,
  maxCharsPerLine,
}: BalancesChartXAxisTickProps) {
  const value = payload?.value ?? '';
  const lines = wrapInstitutionLabel(value, maxCharsPerLine);
  const tickX = typeof x === 'number' ? x : Number(x);
  const tickY = typeof y === 'number' ? y : Number(y);

  return (
    <g transform={`translate(${tickX},${tickY + INSTITUTION_LABEL_AXIS_GAP})`}>
      <text textAnchor="middle" fill={fill} fontSize={INSTITUTION_LABEL_FONT_SIZE}>
        {lines.map((line, index) => (
          <tspan
            key={`${value}:${line}`}
            x={0}
            dy={index === 0 ? 0 : INSTITUTION_LABEL_LINE_HEIGHT}
          >
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}
