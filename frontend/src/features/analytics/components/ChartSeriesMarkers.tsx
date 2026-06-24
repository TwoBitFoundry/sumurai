import type { ActiveDotProps, DotItemDotProps } from 'recharts';

export const chartSeriesDotRadius = {
  default: 5,
  active: 7,
  hit: 10,
} as const;

function ChartSeriesDot({
  cx,
  cy,
  radius,
  fill,
}: {
  cx: number;
  cy: number;
  radius: number;
  fill: string;
}) {
  return <circle cx={cx} cy={cy} r={radius} fill={fill} />;
}

function createChartSeriesDotRenderer(fill: string, radius: number) {
  return ({ cx, cy }: { cx?: number; cy?: number }) => {
    if (cx == null || cy == null) {
      return null;
    }

    if (radius === chartSeriesDotRadius.default) {
      return (
        <g>
          <circle cx={cx} cy={cy} r={chartSeriesDotRadius.hit} fill="transparent" stroke="none" />
          <ChartSeriesDot cx={cx} cy={cy} radius={radius} fill={fill} />
        </g>
      );
    }

    return <ChartSeriesDot cx={cx} cy={cy} radius={radius} fill={fill} />;
  };
}

export function renderChartSeriesDot(fill: string, radius: number = chartSeriesDotRadius.default) {
  const render = createChartSeriesDotRenderer(fill, radius);
  return (props: DotItemDotProps) => render(props);
}

export function renderChartSeriesActiveDot(
  fill: string,
  radius: number = chartSeriesDotRadius.active
) {
  const render = createChartSeriesDotRenderer(fill, radius);
  return (props: ActiveDotProps) => render(props);
}

export function chartSeriesDotProps(fill: string) {
  return {
    dot: renderChartSeriesDot(fill),
    activeDot: renderChartSeriesActiveDot(fill),
  };
}
