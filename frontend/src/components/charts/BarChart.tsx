import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { cn } from '@/lib/utils';

export interface BarChartDataPoint {
  [key: string]: string | number;
}

export interface BarConfig {
  dataKey: string;
  name?: string;
  color?: string;
  stackId?: string;
  radius?: number | [number, number, number, number];
}

export interface BarChartProps {
  data: BarChartDataPoint[];
  bars: BarConfig[];
  xAxisDataKey: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  showTooltip?: boolean;
  layout?: 'horizontal' | 'vertical';
  className?: string;
  formatTooltip?: (value: number, name: string) => string;
  formatXAxis?: (value: string) => string;
  formatYAxis?: (value: number) => string;
}

// Chart colors that work well with the theme
const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export function BarChart({
  data,
  bars,
  xAxisDataKey,
  xAxisLabel,
  yAxisLabel,
  height = 300,
  showGrid = true,
  showLegend = true,
  showTooltip = true,
  layout = 'horizontal',
  className,
  formatTooltip,
  formatXAxis,
  formatYAxis,
}: BarChartProps) {
  const isVertical = layout === 'vertical';

  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart
          data={data}
          layout={layout}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          {showGrid && (
            <CartesianGrid
              strokeDasharray="3 3"
              className="stroke-muted"
              vertical={!isVertical}
              horizontal={isVertical}
            />
          )}
          {isVertical ? (
            <>
              <XAxis
                type="number"
                tickLine={false}
                axisLine={false}
                className="text-xs fill-muted-foreground"
                tickFormatter={formatYAxis}
                label={
                  yAxisLabel
                    ? { value: yAxisLabel, position: 'insideBottom', offset: -5 }
                    : undefined
                }
              />
              <YAxis
                type="category"
                dataKey={xAxisDataKey}
                tickLine={false}
                axisLine={false}
                className="text-xs fill-muted-foreground"
                tickFormatter={formatXAxis}
                width={100}
                label={
                  xAxisLabel
                    ? { value: xAxisLabel, angle: -90, position: 'insideLeft' }
                    : undefined
                }
              />
            </>
          ) : (
            <>
              <XAxis
                dataKey={xAxisDataKey}
                tickLine={false}
                axisLine={false}
                className="text-xs fill-muted-foreground"
                tickFormatter={formatXAxis}
                label={
                  xAxisLabel
                    ? { value: xAxisLabel, position: 'insideBottom', offset: -5 }
                    : undefined
                }
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                className="text-xs fill-muted-foreground"
                tickFormatter={formatYAxis}
                label={
                  yAxisLabel
                    ? { value: yAxisLabel, angle: -90, position: 'insideLeft' }
                    : undefined
                }
              />
            </>
          )}
          {showTooltip && (
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 'var(--radius)',
                color: 'hsl(var(--card-foreground))',
              }}
              formatter={formatTooltip}
              cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
            />
          )}
          {showLegend && (
            <Legend
              wrapperStyle={{
                paddingTop: '10px',
              }}
            />
          )}
          {bars.map((bar, index) => (
            <Bar
              key={bar.dataKey}
              dataKey={bar.dataKey}
              name={bar.name || bar.dataKey}
              fill={bar.color || CHART_COLORS[index % CHART_COLORS.length]}
              stackId={bar.stackId}
              radius={bar.radius || [4, 4, 0, 0]}
            />
          ))}
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default BarChart;
