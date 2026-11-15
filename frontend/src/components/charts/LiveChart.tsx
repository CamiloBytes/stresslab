import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { LivePoint } from "../../hooks/useRunStream";

export interface ChartSeries {
  key: keyof Pick<LivePoint, "rps" | "avgLatencyMs" | "errorRate" | "vus">;
  color: string;
  label: string;
}

interface LiveChartProps {
  data: LivePoint[];
  series: ChartSeries[];
  height?: number;
  valueFormatter?: (value: number, key: ChartSeries["key"]) => string;
}

const AXIS_TICK = {
  fill: "rgba(125,224,255,0.4)",
  fontSize: 10,
  fontFamily: "JetBrains Mono, monospace",
};

function defaultFormatter(value: number, key: ChartSeries["key"]): string {
  if (key === "errorRate") return `${Math.round(value * 100)}%`;
  if (key === "avgLatencyMs") return `${Math.round(value)} ms`;
  return String(Math.round(value));
}

function ChartTooltipContent({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ dataKey?: string | number; color?: string; value?: number; name?: string }>;
  label?: string | number;
}) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="glass rounded-lg px-3 py-2 text-xs">
      <p className="mb-1 font-mono text-sky/50">
        t = {typeof label === "number" ? Math.round(label) : label}s
      </p>
      {payload.map((entry) => (
        <p key={String(entry.dataKey)} className="font-mono" style={{ color: entry.color }}>
          {String(entry.name)}: {entry.value !== undefined ? String(entry.value) : "—"}
        </p>
      ))}
    </div>
  );
}

export function LiveChart({ data, series, height = 220, valueFormatter = defaultFormatter }: LiveChartProps) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <defs>
            {series.map((entry) => (
              <linearGradient key={entry.key} id={`fill-${entry.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={entry.color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={entry.color} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid stroke="rgba(125,224,255,0.08)" strokeDasharray="3 3" />
          <XAxis
            dataKey="t"
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={{ stroke: "rgba(125,224,255,0.15)" }}
            label={{
              value: "segundos",
              position: "insideBottomRight",
              offset: -4,
              style: { fill: "rgba(125,224,255,0.35)", fontSize: 9 },
            }}
          />
          <YAxis
            tick={AXIS_TICK}
            tickFormatter={(value) => String(Math.round(Number(value)))}
            tickLine={false}
            axisLine={false}
            width={54}
          />
          <Tooltip
            content={<ChartTooltipContent />}
            formatter={(value, name) => {
              const numeric = typeof value === "number" ? value : Number(value ?? 0);
              const entry = series.find((item) => item.label === String(name));
              return valueFormatter(numeric, entry?.key ?? "rps");
            }}
          />
          <Legend wrapperStyle={{ fontSize: 10, fontFamily: "JetBrains Mono, monospace" }} iconType="circle" iconSize={7} />
          {series.map((entry) => (
            <Area
              key={entry.key}
              type="monotone"
              dataKey={entry.key}
              name={entry.label}
              stroke={entry.color}
              strokeWidth={1.8}
              fill={`url(#fill-${entry.key})`}
              isAnimationActive={false}
              dot={false}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
