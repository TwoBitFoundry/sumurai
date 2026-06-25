import type { CurveProps } from 'recharts';
import { netWorthLineChart } from '@/ui/recipes';
import { ChartGlowLineCurve, ChartGlowLineFilter } from './ChartGlowLineCurve';

export function netWorthLineGlowFilterId(instanceId: string) {
  return `${instanceId}-net-worth-curve-glow`;
}

const netWorthGlowLineStyle = {
  blurStdDeviation: netWorthLineChart.curveGlow.blurStdDeviation,
  glowStrokeWidth: netWorthLineChart.curveGlow.strokeWidth,
  glowOpacity: netWorthLineChart.curveGlow.opacity,
  lineStrokeWidth: netWorthLineChart.lineStrokeWidth,
} as const;

export function NetWorthLineGlowFilter({ filterId }: { filterId: string }) {
  return (
    <ChartGlowLineFilter
      filterId={filterId}
      blurStdDeviation={netWorthLineChart.curveGlow.blurStdDeviation}
    />
  );
}

export function NetWorthGlowLineCurve({
  curveProps,
  stroke,
  filterId,
}: {
  curveProps: CurveProps;
  stroke: string;
  filterId: string;
}) {
  return (
    <ChartGlowLineCurve
      curveProps={curveProps}
      stroke={stroke}
      filterId={filterId}
      style={netWorthGlowLineStyle}
    />
  );
}
