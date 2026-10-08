import { describe, expect, it } from "vitest";
import fixture from "../data/mock-data.json";
import {
  defaults,
  filterSales,
  recommend,
  inventoryRows,
  dupattaAnalysis,
  trend,
} from "../lib/analytics";
import { facetCounts } from "../lib/filter-options";
import type { Dataset } from "../lib/types";
const data = fixture as unknown as Dataset;

describe("deep filter demo coverage", () => {
  it("keeps Head Office production candidates and inbound-only variants selectable", () => {
    expect(
      facetCounts(data, {}, defaults, "replenishment", "location").get("HO"),
    ).toBeGreaterThan(0);
    expect(
      facetCounts(
        data,
        { location: "HO" },
        defaults,
        "replenishment",
        "channel",
      ).get("Ecommerce"),
    ).toBeGreaterThan(0);
    expect(
      facetCounts(
        data,
        { q: "LM-P012", location: "S1" },
        defaults,
        "replenishment",
        "size",
      ).get("M"),
    ).toBeGreaterThan(0);
  });
  it("has recent sales for every active catalogue size in every location, including fully specified attribute combinations", () => {
    for (const p of data.products.filter(
      (p) => !["P007", "P014"].includes(p.id),
    )) {
      for (const size of p.sizes)
        for (const loc of data.locations) {
          expect(
            filterSales(data, {
              location: loc.id,
              channel: loc.id === "HO" ? "Ecommerce" : "Store",
              from: "2026-09-29",
              to: "2026-10-05",
              category: p.category,
              fabric: p.fabric,
              color: p.color,
              craft: p.craft,
              size,
              q: p.sku,
            }).length,
            `${p.id}/${size}/${loc.id}`,
          ).toBeGreaterThan(0);
        }
    }
  });
  it("supports every store's operational reports", () => {
    const rows = inventoryRows(data),
      plans = recommend(data, defaults);
    for (const loc of data.locations.filter((l) => l.type === "store")) {
      expect(
        rows.some(
          (r) => r.locationId === loc.id && r.available === 0 && r.sold > 0,
        ),
      ).toBe(true);
      expect(plans.some((r) => r.destination === loc.id)).toBe(true);
      expect(
        plans.some((r) => r.destination === loc.id && r.kind === "Rotate"),
      ).toBe(true);
      expect(
        data.transfers.some((t) => t.destination === loc.id && t.inTransit > 0),
      ).toBe(true);
      expect(
        data.transfers.some(
          (t) =>
            t.destination === loc.id &&
            t.received > 0 &&
            t.receivedDate! >= "2026-09-29",
        ),
      ).toBe(true);
      expect(
        dupattaAnalysis(data, { location: loc.id }).some(
          (r) => r.withUnits > 0,
        ),
      ).toBe(true);
      expect(
        trend(data, "P003", 7, { location: loc.id }).change!,
      ).toBeGreaterThan(30);
      expect(
        trend(data, "P005", 10, { location: loc.id }).change!,
      ).toBeLessThan(-30);
    }
  });
  it("disables impossible catalogue and store/channel combinations rather than showing unrelated rows", () => {
    expect(
      facetCounts(data, { size: "M" }, defaults, "inventory", "category").get(
        "Dupattas",
      ) || 0,
    ).toBe(0);
    expect(
      facetCounts(data, { location: "S1" }, defaults, "sales", "channel").get(
        "Ecommerce",
      ) || 0,
    ).toBe(0);
    expect(
      facetCounts(
        data,
        { category: "Dupattas" },
        defaults,
        "inventory",
        "size",
      ).get("Free"),
    ).toBeGreaterThan(0);
  });
  it("only enables choices that have real rows under all other selected filters", () => {
    const filters = {
      location: "S1",
      from: "2026-09-29",
      to: "2026-10-05",
      fabric: "Chanderi",
      size: "M",
    };
    for (const facet of ["category", "color", "craft"] as const) {
      for (const [value, count] of facetCounts(
        data,
        filters,
        defaults,
        "sales",
        facet,
      )) {
        expect(count).toBeGreaterThan(0);
        expect(filterSales(data, { ...filters, [facet]: value }).length).toBe(
          count,
        );
      }
    }
  });
});
