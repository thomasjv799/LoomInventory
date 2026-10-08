import { describe, it, expect } from "vitest";
import fixture from "../data/mock-data.json";
import {
  inventoryRows,
  recommend,
  filterSales,
  priceBands,
  csv,
  defaults,
  trend,
  optionHealth,
  filterInventory,
  dupattaAnalysis,
} from "../lib/analytics";
import type { Dataset } from "../lib/types";
const data = fixture as unknown as Dataset;
describe("inventory rules", () => {
  it("excludes dispatch center, quarantine and reservations from available quantities", () => {
    const row = inventoryRows(data).find(
      (r) => r.variantId === "P001-M" && r.locationId === "HO",
    )!;
    expect(row.excluded).toBe(3);
    expect(row.quarantine).toBe(2);
    expect(row.available).toBe(row.sellable - row.reserved);
    expect(row.physical).toBe(row.sellable + row.excluded + row.quarantine);
  });
  it("tracks inbound separately until receipt", () => {
    const row = inventoryRows(data).find(
      (r) => r.variantId === "P001-M" && r.locationId === "S1",
    )!;
    expect(row.available).toBe(0);
    expect(row.inTransit).toBe(4);
  });
  it("never overallocates a source when recommending replenishment and rotations", () => {
    const rows = inventoryRows(data);
    const plans = recommend(data, defaults);
    expect(plans.length).toBeGreaterThan(0);
    const allocated = new Map<string, number>();
    for (const p of plans) {
      const k = p.source + ":" + p.variantId;
      allocated.set(k, (allocated.get(k) || 0) + p.quantity);
    }
    for (const [key, q] of allocated) {
      const [loc, vid] = key.split(":");
      expect(q).toBeLessThanOrEqual(
        rows.find((r) => r.locationId === loc && r.variantId === vid)!
          .available,
      );
    }
  });
  it("makes recommendations responsive to coverage settings", () => {
    const a = recommend(data, { ...defaults, cover: 5 });
    const b = recommend(data, { ...defaults, cover: 40 });
    expect(b.reduce((s, p) => s + p.quantity, 0)).toBeGreaterThanOrEqual(
      a.reduce((s, p) => s + p.quantity, 0),
    );
  });
  it("marks a missing required size as broken", () => {
    expect(
      optionHealth(data, "S3", defaults).find((x) => x.productId === "P005")
        ?.healthy,
    ).toBe(false);
  });
});
describe("sales and exports", () => {
  it("applies location/channel/date filters consistently", () => {
    const result = filterSales(data, {
      location: "S1",
      channel: "Store",
      from: "2026-10-01",
      to: "2026-10-05",
    });
    expect(result.length).toBeGreaterThan(0);
    expect(
      result.every(
        (s) =>
          s.locationId === "S1" &&
          s.date >= "2026-10-01" &&
          s.date <= "2026-10-05",
      ),
    ).toBe(true);
    expect(
      filterSales(data, { location: "S1", channel: "Ecommerce" }),
    ).toHaveLength(0);
  });
  it("does not substitute suggested MRP for missing net sales price", () => {
    const missing = data.sales.filter((s) => s.netValue === null);
    expect(priceBands(missing).reduce((n, b) => n + b.units, 0)).toBe(0);
  });
  it("compares complete calendar windows for trends", () => {
    const t = trend(data, "P003", 7, {});
    expect(t.currentStart).toBe("2026-09-29");
    expect(t.currentEnd).toBe("2026-10-05");
  });
  it("escapes delimiters and prevents spreadsheet formulas in exports", () => {
    const result = csv([{ name: "=1+1", note: "a,b" }]);
    expect(result).toContain("'=1+1");
    expect(result).toContain('"a,b"');
  });
});

describe("linked reports", () => {
  it("reconciles selling-stockout and inactive drilldowns with the overview predicates", () => {
    const rows = inventoryRows(data);
    expect(filterInventory(data, { status: "Selling stockout" }).length).toBe(
      rows.filter((r) => r.available === 0 && r.sold > 0).length,
    );
    expect(
      filterInventory(data, { status: "Inactive" }).reduce(
        (n, r) => n + r.available,
        0,
      ),
    ).toBe(
      rows
        .filter(
          (r) =>
            r.available > 0 &&
            (r.lastSale
              ? r.lastSale < "2026-08-07"
              : r.product.launchDate <= "2026-08-07"),
        )
        .reduce((n, r) => n + r.available, 0),
    );
  });
  it("uses configured cover in both status classification and filtering", () => {
    const result = filterInventory(
      data,
      { status: "Low stock" },
      { ...defaults, cover: 40 },
    );
    expect(result.length).toBeGreaterThan(0);
    expect(
      result.every((r) => r.cover !== null && r.cover < 40 && r.available > 0),
    ).toBe(true);
  });
  it("searches size-specific SKUs", () => {
    const result = filterInventory(data, { q: "LM-P001-M" });
    expect(result.length).toBe(6);
    expect(result.every((r) => r.size === "M")).toBe(true);
    expect(filterSales(data, { q: "LM-P001-M" }).length).toBeGreaterThan(0);
  });
  it("retains free-size dupatta supply when outfits are filtered to size M", () => {
    const results = dupattaAnalysis(data, { size: "M" });
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.matched > 0)).toBe(true);
  });
});

describe("donor protection and catalogue search", () => {
  it("protects ecommerce cover in the central donor pool", () => {
    const setting = { ...defaults, cover: 40 };
    const rows = inventoryRows(data);
    const plans = recommend(data, setting);
    for (const row of rows) {
      const allocated = plans
        .filter(
          (p) => p.source === row.locationId && p.variantId === row.variantId,
        )
        .reduce((n, p) => n + p.quantity, 0);
      if (allocated)
        expect(row.available - allocated).toBeGreaterThanOrEqual(
          Math.max(setting.minimum, Math.ceil(row.rate * (setting.cover + 3))),
        );
    }
  });
  it("includes the named feasible rotation scenario", () => {
    expect(recommend(data, defaults).some((p) => p.kind === "Rotate")).toBe(
      true,
    );
  });
});

describe("visible scenarios", () => {
  it("has store fast-seller stockout history", () => {
    const row = inventoryRows(data).find(
      (r) => r.variantId === "P003-M" && r.locationId === "S1",
    )!;
    expect(row.stockoutDays).toBeGreaterThan(0);
    expect(row.rate).toBeGreaterThanOrEqual(defaults.fast);
  });
  it("does not mark a newly introduced unsold style as inactive before the observation window", () => {
    const modified = {
      ...data,
      products: data.products.map((p) =>
        p.id === "P014" ? { ...p, launchDate: "2026-10-01" } : p,
      ),
      sales: data.sales.filter((s) => s.productId !== "P014"),
    };
    expect(
      filterInventory(modified, { status: "Inactive", q: "LM-P014" }),
    ).toHaveLength(0);
  });
});
