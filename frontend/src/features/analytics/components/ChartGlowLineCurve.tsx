import type { CurveProps } from 'recharts';
import { Curve } from 'recharts';

export type ChartGlowLineStyle = {
  blurStdDeviation: number;
  glowStrokeWidth: number;
  glowOpacity: number;
  lineStrokeWidth: number;
};

export function ChartGlowLineFilter({
  filterId,
  blurStdDeviation,
}: {
  filterId: string;
  blurStdDeviation: number;
}) {
  return (
    <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur in="SourceGraphic" stdDeviation={blurStdDeviation} />
    </filter>
  );
}

export function ChartGlowLineCurve({
  curveProps,
  stroke,
  filterId,
  style,
}: {
  curveProps: CurveProps;
  stroke: string;
  filterId: string;
  style: ChartGlowLineStyle;
}) {
  const { strokeDasharray: _strokeDasharray, ...curveWithoutDash } = curveProps;

  return (
    <g>
      <Curve
        {...curveWithoutDash}
        stroke={stroke}
        strokeWidth={style.glowStrokeWidth}
        fill="none"
        filter={`url(#${filterId})`}
        opacity={style.glowOpacity}
      />
      <Curve
        {...curveWithoutDash}
        stroke={stroke}
        strokeWidth={style.lineStrokeWidth}
        fill="none"
      />
    </g>
  );
}
