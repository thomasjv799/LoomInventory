import { filtersForReport } from "./report-filters";
import type { Dataset, Filters, Settings, InventoryRow } from "./types";
import type { ReportName, PreparedReport, ReportRow } from "./report-types";
import {
  filterInventory,
  filterSales,
  recommend,
  optionHealth,
  trend,
  priceBands,
  attributes,
  series,
  dupattaAnalysis,
  dayBefore,
  productMatches,
} from "./analytics";
import { facetCounts, type Facet } from "./filter-options";
const sum = <T>(rows: T[], fn: (r: T) => number) =>
  rows.reduce((n, r) => n + fn(r), 0);
const columns = (names: Record<string, string>) =>
  Object.entries(names).map(([key, label]) => ({ key, label }));
export function buildReport(
  d: Dataset,
  name: ReportName,
  f: Filters,
  s: Settings,
): PreparedReport {
  const context = filtersForReport(name, f);
  f = context.applied;
  const location = (id: string) =>
    d.locations.find((l) => l.id === id)?.name ?? id;
  const base = (r: InventoryRow): ReportRow => ({
    id: r.id,
    productId: r.productId,
    sku: r.sku,
    name: r.product.name,
    image: r.product.image,
    size: r.size,
    location: location(r.locationId),
    locationId: r.locationId,
    available: r.available,
    physical: r.physical,
    excluded: r.excluded,
    quarantine: r.quarantine,
    reserved: r.reserved,
    inTransit: r.inTransit,
    sold: r.sold,
    stockoutDays: r.stockoutDays,
    cover: r.cover === null ? null : Math.round(r.cover * 10) / 10,
    status: r.status,
    lastSale: r.lastSale,
  });
  const inv = filterInventory(d, f, s),
    sales = filterSales(d, f);
  const totals: PreparedReport["totals"] = {
    available: sum(inv, (r) => r.available),
    inTransit: sum(inv, (r) => r.inTransit),
    sellingStockouts: inv.filter((r) => r.available === 0 && r.sold > 0).length,
    units: sum(sales, (r) => r.quantity),
    netValueMinor: sum(sales, (r) => r.netValue ?? 0),
  };
  const result: PreparedReport = {
    rows: [],
    columns: [],
    totals,
    charts: [],
    notes: [
      "All business values are simulated. Dispatch center, quarantined and unreceived transit units are excluded from available stock.",
    ],
  };
  const inventoryColumns = {
    name: "Style",
    size: "Size",
    location: "Location",
    available: "Available",
    physical: "Physical",
    excluded: "Excluded bins",
    quarantine: "Quarantine",
    reserved: "Reserved",
    inTransit: "In transit",
    sold: "Sold · 28 days",
    stockoutDays: "Stockout days · 28 days",
    status: "Status",
  };
  if (
    name === "inventory" ||
    name === "slow-stock" ||
    name === "ho-shortages"
  ) {
    let rows = inv;
    if (name === "slow-stock")
      rows = inv.filter(
        (r) =>
          r.available > 0 &&
          (!r.lastSale ||
            r.lastSale <= dayBefore(d.asOf, s.deadDays) ||
            r.rate < s.slow),
      );
    if (name === "ho-shortages")
      rows = filterInventory(d, { ...f, location: "HO" }, s).filter(
        (r) =>
          r.available === 0 &&
          filterInventory(d, { ...f, location: undefined }, s).some(
            (x) => x.variantId === r.variantId && x.sold > 0,
          ),
      );
    result.rows = rows.map(base);
    result.columns = columns(inventoryColumns);
    result.totals = {
      available: sum(rows, (r) => r.available),
      physical: sum(rows, (r) => r.physical),
      inTransit: sum(rows, (r) => r.inTransit),
      excluded: sum(rows, (r) => r.excluded),
      quarantine: sum(rows, (r) => r.quarantine),
      reserved: sum(rows, (r) => r.reserved),
      sellingStockouts: rows.filter((r) => r.available === 0 && r.sold > 0)
        .length,
      rows: rows.length,
    };
    if (name === "ho-shortages")
      result.notes.push(
        "HO sizes with zero available stock and observed demand in the network.",
      );
  } else if (name === "rotation" || name === "replenishment") {
    const plans = recommend(d, s).filter(
      (r) =>
        (name !== "rotation" || r.kind === "Rotate") &&
        (!f.location || r.destination === f.location) &&
        (!f.size || r.size === f.size) &&
        productMatches(
          d.products.find((p) => p.id === r.productId)!,
          f,
        ),
    );
    result.rows = plans.map((r) => ({
      id: r.id,
      productId: r.productId,
      variantId: r.variantId,
      name: d.products.find((p) => p.id === r.productId)!.name,
      size: r.size,
      source: r.source,
      from: location(r.source),
      destination: r.destination,
      to: location(r.destination),
      quantity: r.quantity,
      incoming: r.incoming,
      target: r.target,
      leadDays: r.leadDays,
      reason: r.reason,
    }));
    result.columns = columns({
      name: "Style",
      size: "Size",
      from: "Send from",
      to: "Send to",
      quantity: "Suggested units",
      incoming: "Expected inbound",
      target: "Target stock",
      leadDays: "Assumed lead days",
      reason: "Why",
    });
    result.totals = {
      suggestedUnits: sum(plans, (r) => r.quantity),
      suggestions: plans.length,
    };
    result.notes.push(
      "Suggestions are not reservations. Current availability is checked again during dispatch. Target days + 3 days lead time; incoming stock due within that horizon is counted.",
    );
  } else if (name === "stores") {
    for (const l of d.locations.filter(
      (l) => l.type === "store" && (!f.location || l.id === f.location),
    ))
      for (const h of optionHealth(d, l.id, s).filter((h) =>
        productMatches(h.product, f),
      ))
        result.rows.push({
          id: l.id + ":" + h.productId,
          productId: h.productId,
          name: h.product.name,
          location: l.name,
          healthy: h.healthy ? "All required sizes" : "Missing sizes",
          missing: h.missing.join(", ") || "None",
          available: h.current,
          units: h.sold,
          sellthrough: Math.round(h.sellthrough),
          classification: h.classification,
          fresh: h.fresh ? "New season" : "Earlier season",
        });
    result.columns = columns({
      name: "Style",
      location: "Store",
      healthy: "Size availability",
      missing: "Missing required sizes",
      available: "Available",
      units: "Sold · 28 days",
      sellthrough: "Sell-through %",
      classification: "Hit / Average / Miss",
      fresh: "Freshness",
    });
    result.totals = {
      styles: result.rows.length,
      stylesWithAllSizes: result.rows.filter((r) => r.missing === "None")
        .length,
      stylesMissingSizes: result.rows.filter((r) => r.missing !== "None")
        .length,
      freshnessPercent: result.rows.length
        ? Math.round(
            (result.rows.filter((r) => r.fresh === "New season").length /
              result.rows.length) *
              100,
          )
        : null,
    };
    result.notes.push(
      `A style has all required sizes when each applicable ${s.coreSizes.join(", ")} size holds at least ${s.minimum} available unit(s).`,
    );
  } else if (name === "sales") {
    result.rows = d.products
      .filter((p) => productMatches(p, f))
      .map((p) => {
        const ss = sales.filter((x) => x.productId === p.id),
          up = trend(d, p.id, 7, f),
          down = trend(d, p.id, 10, f),
          priced = ss.filter((x) => x.netValue !== null);
        return {
          id: p.id,
          productId: p.id,
          name: p.name,
          sku: p.sku,
          fabric: p.fabric,
          craft: p.craft,
          color: p.color,
          units: sum(ss, (x) => x.quantity),
          netValueMinor: sum(priced, (x) => x.netValue!),
          actualUnitPriceMinor: sum(priced, (x) => x.quantity)
            ? Math.round(
                sum(priced, (x) => x.netValue!) /
                  sum(priced, (x) => x.quantity),
              )
            : null,
          unpricedUnits: sum(
            ss.filter((x) => x.netValue === null),
            (x) => x.quantity,
          ),
          change7: up.change === null ? null : Math.round(up.change),
          change10: down.change === null ? null : Math.round(down.change),
          trend:
            up.change !== null && up.change >= s.spike
              ? "Sales increased"
              : down.change !== null && down.change <= -s.drop
                ? "Sales dropped"
                : "Stable / insufficient data",
        };
      })
      .filter((r) => r.units > 0 || r.change7 !== null || r.change10 !== null);
    result.columns = columns({
      name: "Style",
      fabric: "Fabric",
      craft: "Craft",
      color: "Colour",
      units: "Units sold",
      netValueMinor: "Net sales · ₹",
      actualUnitPriceMinor: "Actual unit price · ₹",
      unpricedUnits: "Unpriced units",
      change7: "7-day change %",
      change10: "10-day change %",
      trend: "Trend",
    });
    result.charts = [
      {
        label: "Actual selling-price bands",
        x: "name",
        y: "units",
        data: priceBands(sales).map((b) => ({ name: b.name, units: b.units })),
      },
      ...(["fabric", "color", "craft", "style"] as const).map((attribute) => ({
        label: `Sales by ${attribute}`,
        x: "name",
        y: "units",
        data: attributes(d, sales, attribute).map((a) => ({
          name: a.name,
          units: a.units,
        })),
      })),
      {
        label: "Size mix",
        x: "name",
        y: "units",
        data: [...new Set(d.variants.map((v) => v.size))].map((size) => ({
          name: size,
          units: sum(
            sales.filter(
              (x) =>
                d.variants.find((v) => v.id === x.variantId)?.size === size,
            ),
            (x) => x.quantity,
          ),
        })),
      },
    ];
    result.notes.push(
      "Price bands use actual transaction value per unit. Unknown prices stay unknown. Trend windows use completed days relative to as-of, independent of the display date filter.",
    );
  } else if (name === "size-packs") {
    const sizeCohort = filterInventory(
      d,
      { ...f, size: undefined, status: undefined },
      s,
    );
    result.rows = inv.map((r) => {
      const style = sizeCohort.filter(
          (x) => x.productId === r.productId && x.locationId === r.locationId,
        ),
        total = sum(style, (x) => x.sold),
        received = d.transfers.filter(
          (t) =>
            t.variantId === r.variantId &&
            t.destination === r.locationId &&
            t.receivedDate,
        );
      const lead = received.length
        ? sum(
            received,
            (t) =>
              (Date.parse(t.receivedDate!) - Date.parse(t.dispatchDate)) /
              86400000,
          ) / received.length
        : null;
      return {
        ...base(r),
        observedRatioPercent: total ? Math.round((r.sold / total) * 100) : null,
        observedLeadDays: lead === null ? null : Math.round(lead * 10) / 10,
        suggestedUnits: Math.max(
          s.minimum,
          Math.ceil(r.rate * ((s.peak ? s.peakCover : s.cover) + 3)),
        ),
        evidence: r.exposure >= 14 ? "Observed size mix" : "Insufficient data",
      };
    });
    result.columns = columns({
      name: "Style",
      size: "Size",
      location: "Location",
      sold: "Sold · 28 days",
      stockoutDays: "Stockout days",
      observedLeadDays: "Observed lead days",
      observedRatioPercent: "Observed size ratio %",
      suggestedUnits: "Target size units",
      evidence: "Evidence",
    });
    result.notes.push(
      "Ratios use observed sales, with stockout days and receipt delays shown alongside. Lost demand is not estimated. Peak/non-peak target days come from Settings.",
    );
  } else if (name === "forecasts") {
    result.rows = d.sizeForecasts
      .filter(
        (v) =>
          productMatches(
            d.products.find((p) => p.id === v.productId)!,
            f,
          ) &&
          (!f.size || v.size === f.size),
      )
      .map((v) => ({
        id: v.variantId + v.month,
        productId: v.productId,
        name: d.products.find((p) => p.id === v.productId)!.name,
        size: v.size,
        month: v.month,
        units: v.units,
        factor: v.factor,
        method: v.method,
      }));
    result.columns = columns({
      name: "Style",
      size: "Size",
      month: "Month",
      units: "Projected units",
      factor: "Season factor",
      method: "Assumptions",
    });
    result.totals = {
      projectedUnits: sum(result.rows, (r) => Number(r.units)),
    };
    result.notes.push(
      "Precomputed simulated network projections: 28-day baseline, synthetic season factors and observed size allocation. Changing settings does not retrain these forecasts.",
    );
  } else if (name === "events") {
    const ps = new Set(
      d.products.filter((p) => productMatches(p, f)).map((p) => p.id),
    );
    result.calendar = d.events;
    result.rows = d.influencers
      .filter(
        (i) =>
          ps.has(i.productId) &&
          (!f.from || i.date >= f.from) &&
          (!f.to || i.date <= f.to),
      )
      .map((i) => ({
        id: i.id,
        productId: i.productId,
        name: d.products.find((p) => p.id === i.productId)!.name,
        creator: i.name,
        date: i.date,
        channel: i.channel,
        note: i.note,
      }));
    result.columns = columns({
      name: "Style",
      creator: "Fictional creator",
      date: "Activity date",
      channel: "Activity channel",
      note: "Evidence",
    });
    result.charts = [
      {
        label: "Sales timeline · selected location/channel",
        x: "date",
        y: "units",
        data: series(sales).map((x) => ({ date: x.date, units: x.units })),
      },
    ];
    result.notes.push(
      "Creator activity is fictional; timing is association, not proof of causation. Store/channel filters affect the sales timeline only. Festival calendar is independent of the activity date range.",
    );
    result.totals = {
      creatorActivities: result.rows.length,
      timelineUnits: sum(sales, (x) => x.quantity),
    };
  } else if (name === "dupatta") {
    result.rows = dupattaAnalysis(d, f).map((r) => ({
      id: r.id,
      productId: r.product.id,
      name: r.product.name,
      dupatta: r.dupatta.name,
      withUnits: r.withUnits,
      without: r.without,
      unknown: r.unknown,
      attachment: r.attachment === null ? null : Math.round(r.attachment),
      outfits: r.outfits,
      matched: r.matched,
      shortage: r.shortage,
      coverage: r.coverage === null ? null : Math.round(r.coverage),
    }));
    result.columns = columns({
      name: "Outfit",
      dupatta: "Mapped dupatta",
      withUnits: "With matching dupatta",
      without: "Without",
      unknown: "Unknown",
      attachment: "Attachment %",
      outfits: "Outfits available",
      matched: "Covered outfits",
      shortage: "Dupatta shortage",
      coverage: "Coverage %",
    });
    result.totals = {
      shortage: sum(result.rows, (r) => Number(r.shortage)),
      outfits: sum(result.rows, (r) => Number(r.outfits)),
    };
    result.notes.push(
      "Explicit simulated outfit-to-dupatta relationships. Attachment excludes unknown matching evidence; shared dupatta stock is allocated once.",
    );
  } else {
    result.rows = inv
      .filter(
        (r) =>
          r.status !== "Healthy" ||
          (r.available > 0 &&
            (!r.lastSale || r.lastSale < dayBefore(d.asOf, s.deadDays))),
      )
      .map((r) => ({
        ...base(r),
        priority:
          r.available === 0 && r.sold > 0
            ? "Replenish missing size"
            : !r.lastSale || r.lastSale < dayBefore(d.asOf, s.deadDays)
              ? "Review slow/dead stock"
              : "Review low cover",
      }));
    result.columns = columns({
      name: "Style",
      size: "Size",
      location: "Location",
      available: "Available",
      sold: "Sold · 28 days",
      priority: "Priority",
      stockoutDays: "Stockout days",
    });
    result.totals = { ...totals, attentionRows: result.rows.length };
  }
  if (context.ignored.length)
    result.notes.push(
      "Filters not applied to this report: " + context.ignored.join(", ") + ".",
    );
  result.facets = Object.fromEntries(
    (
      [
        "location",
        "channel",
        "category",
        "fabric",
        "color",
        "craft",
        "size",
        "status",
      ] as Facet[]
    ).map((key) => [
      key,
      [...facetCounts(d, f, s, name, key)].map(([value, count]) => ({
        value,
        count,
      })),
    ]),
  );
  return result;
}
