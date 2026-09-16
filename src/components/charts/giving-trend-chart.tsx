"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip, formatMonth } from "./chart-tooltip";
import { BRAND_PURPLE, CHART_GRID, CHART_MUTED_TEXT } from "@/lib/chart-colors";

export function GivingTrendChart({ data }: { data: { month: string; amount: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="givingFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={BRAND_PURPLE} stopOpacity={0.28} />
            <stop offset="100%" stopColor={BRAND_PURPLE} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={CHART_GRID} strokeDasharray="3 5" />
        <XAxis
          dataKey="month"
          tickFormatter={formatMonth}
          tick={{ fontSize: 11, fill: CHART_MUTED_TEXT }}
          tickLine={false}
          axisLine={{ stroke: CHART_GRID }}
          interval={0}
          minTickGap={20}
        />
        <YAxis
          tick={{ fontSize: 11, fill: CHART_MUTED_TEXT }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
          width={48}
        />
        <Tooltip content={(props) => <ChartTooltip {...props} />} />
        <Area
          type="monotone"
          dataKey="amount"
          name="Giving"
          stroke={BRAND_PURPLE}
          strokeWidth={2}
          fill="url(#givingFill)"
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
