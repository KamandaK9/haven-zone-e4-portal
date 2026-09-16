"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip, formatUSD } from "./chart-tooltip";
import { CATEGORICAL, CHART_GRID, CHART_MUTED_TEXT } from "@/lib/chart-colors";

export function BarBreakdownChart({
  data,
  dataKey = "amount",
  nameKey = "name",
  layout = "vertical",
  seriesName = "Giving",
  valueFormatter = formatUSD,
}: {
  data: Record<string, string | number>[];
  dataKey?: string;
  nameKey?: string;
  layout?: "vertical" | "horizontal";
  seriesName?: string;
  valueFormatter?: (n: number) => string;
}) {
  const height = layout === "vertical" ? Math.max(180, data.length * 38) : 260;

  if (layout === "vertical") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 4 }}>
          <CartesianGrid horizontal={false} stroke={CHART_GRID} strokeDasharray="3 5" />
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: CHART_MUTED_TEXT }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => valueFormatter(v)}
          />
          <YAxis
            type="category"
            dataKey={nameKey}
            tick={{ fontSize: 12, fill: "var(--foreground)" }}
            tickLine={false}
            axisLine={false}
            width={140}
          />
          <Tooltip content={(props) => <ChartTooltip {...props} />} cursor={{ fill: "var(--muted)" }} />
          <Bar dataKey={dataKey} name={seriesName} radius={[0, 4, 4, 0]} maxBarSize={22}>
            {data.map((_, i) => (
              <Cell key={i} fill={CATEGORICAL[i % CATEGORICAL.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={CHART_GRID} strokeDasharray="3 5" />
        <XAxis
          dataKey={nameKey}
          tick={{ fontSize: 11, fill: CHART_MUTED_TEXT }}
          tickLine={false}
          axisLine={{ stroke: CHART_GRID }}
        />
        <YAxis
          tick={{ fontSize: 11, fill: CHART_MUTED_TEXT }}
          tickLine={false}
          axisLine={false}
          width={48}
        />
        <Tooltip content={(props) => <ChartTooltip {...props} />} cursor={{ fill: "var(--muted)" }} />
        <Bar dataKey={dataKey} name={seriesName} radius={[4, 4, 0, 0]} maxBarSize={40}>
          {data.map((_, i) => (
            <Cell key={i} fill={CATEGORICAL[i % CATEGORICAL.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
