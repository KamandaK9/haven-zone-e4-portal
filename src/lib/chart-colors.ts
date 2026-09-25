import { tenant } from "@/tenant";

// Validated categorical palette (dataviz skill default order — CVD-safe).
export const CATEGORICAL = [
  "#2a78d6", // blue
  "#eb6834", // orange
  "#1baf7a", // aqua
  "#eda100", // yellow
  "#e87ba4", // magenta
  "#008300", // green
  "#4a3aa7", // violet
  "#e34948", // red
];

// The tenant's brand colour, used for single-series/sequential encodings.
export const BRAND_PRIMARY = tenant.chartPrimary;

export const STATUS = {
  good: "#0ca30c",
  warning: "#fab219",
  serious: "#ec835a",
  critical: "#d03b3b",
};

export const CHART_GRID = "#e5e2e9";
export const CHART_MUTED_TEXT = "#7a7585";
