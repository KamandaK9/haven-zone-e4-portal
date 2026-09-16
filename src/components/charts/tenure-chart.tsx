"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip } from "./chart-tooltip";
import { CHART_GRID, CHART_MUTED_TEXT } from "@/lib/chart-colors";

// Ordinal purple ramp, light → dark, each step clears 2:1 contrast on white.
const TENURE_RAMP = ["#c4b5fd", "#a78bfa", "#8b5cf6", "#7c3aed"];

export function TenureChart({ data }: { data: { bucket: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={CHART_GRID} strokeDasharray="3 5" />
        <XAxis
          dataKey="bucket"
          tick={{ fontSize: 11, fill: CHART_MUTED_TEXT }}
          tickLine={false}
          axisLine={{ stroke: CHART_GRID }}
        />
        <YAxis tick={{ fontSize: 11, fill: CHART_MUTED_TEXT }} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
        <Tooltip content={(props) => <ChartTooltip {...props} />} cursor={{ fill: "var(--muted)" }} />
        <Bar dataKey="count" name="Members" radius={[4, 4, 0, 0]} maxBarSize={56}>
          {data.map((_, i) => (
            <Cell key={i} fill={TENURE_RAMP[i % TENURE_RAMP.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
