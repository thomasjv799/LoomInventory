import type { Filters, Settings, Event } from "./types";
export const reportNames = [
  "overview",
  "inventory",
  "stores",
  "rotation",
  "sales",
  "replenishment",
  "ho-shortages",
  "slow-stock",
  "size-packs",
  "forecasts",
  "events",
  "dupatta",
] as const;
export type ReportName = (typeof reportNames)[number];
export type ReportRow = Record<string, string | number | null>;
export interface PreparedReport {
  rows: ReportRow[];
  columns: { key: string; label: string }[];
  totals: Record<string, number | null>;
  charts: { label: string; x: string; y: string; data: ReportRow[] }[];
  notes: string[];
  calendar?: Event[];
  facets?: Record<string, { value: string; count: number }[]>;
}
export interface ReportEnvelope extends Omit<PreparedReport, "rows"> {
  data: ReportRow[];
  meta: {
    asOf: string;
    synthetic: boolean;
    currency: "INR";
    timezone: "Asia/Kolkata";
    sourceWatermark: number;
    settingsVersion: number;
    algorithmVersion: string;
    appliedFilters: Filters;
    ignoredFilters: string[];
    nextCursor: string | null;
    requestId: string;
  };
}
export interface InventoryProvider {
  getReport(
    name: ReportName,
    filters: Filters,
    page?: { cursor?: string; limit?: number; runId?: string },
  ): Promise<ReportEnvelope>;
  getSettings(): Promise<{ values: Settings; version: number }>;
  updateSettings(
    values: Settings,
    expectedVersion: number,
    idempotencyKey: string,
  ): Promise<{ values: Settings; version: number }>;
}
