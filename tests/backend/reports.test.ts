import { test, expect } from "vitest";
import fixture from "../../data/mock-data.json";
import type { Dataset } from "../../lib/types";
import { buildReport } from "../../lib/report-adapters";
import { defaults, filterInventory, filterSales } from "../../lib/analytics";
const d = fixture as Dataset;
test("inventory summary reconciles to every filtered row", () => {
  const report = buildReport(d, "inventory", { location: "S1" }, defaults);
  expect(report.totals.available).toBe(
    filterInventory(d, { location: "S1" }).reduce((n, r) => n + r.available, 0),
  );
  expect(report.rows.reduce((n, r) => n + Number(r.available), 0)).toBe(
    report.totals.available,
  );
});
test("sales uses actual selling values and unknown attachment stays unknown", () => {
  const report = buildReport(d, "sales", { location: "S2" }, defaults);
  expect(report.totals.netValueMinor).toBe(
    filterSales(d, { location: "S2" }).reduce(
      (n, s) => n + (s.netValue ?? 0),
      0,
    ),
  );
  const dupatta = buildReport(d, "dupatta", {}, defaults);
  expect(dupatta.notes.join()).toContain("unknown");
});
test("all fifteen questions have report outputs and forecasts state assumptions", () => {
  for (const name of [
    "overview",
    "stores",
    "rotation",
    "replenishment",
    "ho-shortages",
    "slow-stock",
    "size-packs",
    "forecasts",
    "events",
    "dupatta",
  ] as const)
    expect(buildReport(d, name, {}, defaults).columns.length).toBeGreaterThan(
      0,
    );
  expect(buildReport(d, "forecasts", {}, defaults).notes.join()).toContain(
    "Precomputed",
  );
  const plans = buildReport(d, "rotation", {}, defaults).rows;
  const pool = new Map<string, number>();
  for (const p of plans)
    pool.set(
      String(p.source) + p.variantId,
      (pool.get(String(p.source) + p.variantId) || 0) + Number(p.quantity),
    );
  for (const [key, quantity] of pool)
    expect(quantity).toBeLessThanOrEqual(
      filterInventory(d, {}).find((r) => r.locationId + r.variantId === key)!
        .available,
    );
});
