import type { YAxisTickContentProps } from 'recharts';

type BalancesChartYAxisTickProps = YAxisTickContentProps & {
  fill?: string;
  fontSize?: number;
  formatValue: (value: number) => string;
};

export function BalancesChartYAxisTick({
  x = 0,
  y = 0,
  payload,
  fill,
  fontSize,
  formatValue,
}: BalancesChartYAxisTickProps) {
  const tickX = typeof x === 'number' ? x : Number(x);
  const tickY = typeof y === 'number' ? y : Number(y);
  const value = Number(payload?.value ?? 0);

  return (
    <g transform={`translate(${tickX},${tickY})`}>
      <text x={0} y={0} dy={4} textAnchor="end" fill={fill} fontSize={fontSize}>
        {formatValue(value)}
      </text>
    </g>
  );
}
