import React from 'react';
import type { CurveProps } from 'recharts';
import { Curve } from 'recharts';
import { netWorthLineChart } from '@/ui/recipes';

export function netWorthLineGlowFilterId(instanceId: string) {
  return `${instanceId}-net-worth-curve-glow`;
}

export function NetWorthLineGlowFilter({ filterId }: { filterId: string }) {
  return (
    <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur
        in="SourceGraphic"
        stdDeviation={netWorthLineChart.curveGlow.blurStdDeviation}
      />
    </filter>
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
  const { strokeDasharray: _strokeDasharray, ...curveWithoutDash } = curveProps;

  return (
    <g>
      <Curve
        {...curveWithoutDash}
        stroke={stroke}
        strokeWidth={netWorthLineChart.curveGlow.strokeWidth}
        fill="none"
        filter={`url(#${filterId})`}
        opacity={netWorthLineChart.curveGlow.opacity}
      />
      <Curve
        {...curveWithoutDash}
        stroke={stroke}
        strokeWidth={netWorthLineChart.lineStrokeWidth}
        fill="none"
      />
    </g>
  );
}
