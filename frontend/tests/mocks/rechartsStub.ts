import { mock } from 'bun:test';
import React from 'react';

const Stub = ({ children, ...rest }: { children?: React.ReactNode; [key: string]: unknown }) =>
  React.createElement('div', rest, children);

mock.module('recharts', () => ({
  ResponsiveContainer: Stub,
  LineChart: Stub,
  Line: Stub,
  CartesianGrid: Stub,
  XAxis: Stub,
  YAxis: Stub,
  Tooltip: Stub,
  PieChart: Stub,
  Pie: Stub,
  Cell: Stub,
  Area: Stub,
  AreaChart: Stub,
  Bar: Stub,
  BarChart: Stub,
  ComposedChart: Stub,
  Legend: Stub,
  ReferenceLine: Stub,
  Scatter: Stub,
  ScatterChart: Stub,
  Treemap: Stub,
  RadialBar: Stub,
  RadialBarChart: Stub,
  Radar: Stub,
  RadarChart: Stub,
  PolarAngleAxis: Stub,
  PolarGrid: Stub,
  PolarRadiusAxis: Stub,
}));
