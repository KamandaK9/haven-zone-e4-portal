"use client";

import { Bar, ComposedChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip, formatMonth } from "./chart-tooltip";
import { BRAND_PURPLE, CATEGORICAL, CHART_GRID, CHART_MUTED_TEXT } from "@/lib/chart-colors";

export function GrowthChart({ data }: { data: { month: string; cumulative: number; new: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={CHART_GRID} strokeDasharray="3 5" />
        <XAxis
          dataKey="month"
          tickFormatter={formatMonth}
          tick={{ fontSize: 11, fill: CHART_MUTED_TEXT }}
          tickLine={false}
          axisLine={{ stroke: CHART_GRID }}
        />
        <YAxis tick={{ fontSize: 11, fill: CHART_MUTED_TEXT }} tickLine={false} axisLine={false} width={36} allowDecimals={false} />
        <Tooltip content={(props) => <ChartTooltip {...props} />} cursor={{ fill: "var(--muted)" }} />
        <Bar dataKey="new" name="New members" fill={CATEGORICAL[0]} radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Line
          type="monotone"
          dataKey="cumulative"
          name="Total members"
          stroke={BRAND_PURPLE}
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
