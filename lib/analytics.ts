import type {
  Dataset,
  Filters,
  InventoryRow,
  Product,
  Recommendation,
  SalesLine,
  Settings,
} from "./types";
export const defaults: Settings = {
  cover: 14,
  peakCover: 28,
  minimum: 1,
  coreSizes: ["S", "M", "L", "XL"],
  deadDays: 60,
  spike: 30,
  drop: 30,
  fast: 0.5,
  slow: 0.1,
  hit: 60,
  average: 20,
  freshDays: 90,
  peak: false,
};
export const money = (v: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(v / 100);
export const number = (v: number) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 }).format(v);
export const dayBefore = (date: string, n: number) =>
  new Date(new Date(date + "T00:00:00Z").getTime() - n * 86400000)
    .toISOString()
    .slice(0, 10);
export const productMatches = (p: Product, f: Filters) =>
  (!f.category || p.category === f.category) &&
  (!f.fabric || p.fabric === f.fabric) &&
  (!f.color || p.color === f.color) &&
  (!f.craft || p.craft === f.craft) &&
  (!f.q ||
    `${p.name} ${p.sku} ${p.sizes.map((size) => p.sku + "-" + size).join(" ")}`
      .toLowerCase()
      .includes(f.q.toLowerCase()));
export function filterSales(d: Dataset, f: Filters): SalesLine[] {
  const ps = new Set(
    d.products
      .filter((p) => productMatches(p, { ...f, q: undefined }))
      .map((p) => p.id),
  );
  const vs = new Map(d.variants.map((v) => [v.id, v]));
  return d.sales.filter(
    (s) =>
      ps.has(s.productId) &&
      (!f.q ||
        `${d.products.find((p) => p.id === s.productId)!.name} ${vs.get(s.variantId)?.sku}`
          .toLowerCase()
          .includes(f.q.toLowerCase())) &&
      (!f.location || s.locationId === f.location) &&
      (!f.channel || s.channel === f.channel) &&
      (!f.from || s.date >= f.from) &&
      (!f.to || s.date <= f.to) &&
      (!f.size || vs.get(s.variantId)?.size === f.size),
  );
}
const inventoryCache = new WeakMap<Dataset, InventoryRow[]>();
export function inventoryRows(d: Dataset): InventoryRow[] {
  const cached = inventoryCache.get(d);
  if (cached) return cached;
  const excluded = new Set(d.bins.filter((b) => b.excluded).map((b) => b.id));
  const out: InventoryRow[] = [];
  const saleMap = new Map<string, SalesLine[]>(),
    moveMap = new Map<string, Record<string, number>>();
  for (const s of d.sales) {
    const k = s.variantId + ":" + s.locationId;
    const a = saleMap.get(k) || [];
    a.push(s);
    saleMap.set(k, a);
  }
  for (const m of d.movements) {
    if (m.condition !== "sellable" || excluded.has(m.binId)) continue;
    const k = m.variantId + ":" + m.locationId;
    const a = moveMap.get(k) || {};
    a[m.date] = (a[m.date] || 0) + m.quantity;
    moveMap.set(k, a);
  }
  const balances = new Map<string, typeof d.balances>();
  for (const b of d.balances) {
    const k = b.variantId + ":" + b.locationId;
    const a = balances.get(k) || [];
    a.push(b);
    balances.set(k, a);
  }
  for (const v of d.variants) {
    const product = d.products.find((p) => p.id === v.productId)!;
    for (const loc of d.locations) {
      const k = v.id + ":" + loc.id;
      const bs = balances.get(k) || [];
      const physical = bs.reduce((n, b) => n + b.quantity, 0);
      const ex = bs
        .filter((b) => excluded.has(b.binId))
        .reduce((n, b) => n + b.quantity, 0);
      const sellable = bs
        .filter((b) => b.condition === "sellable" && !excluded.has(b.binId))
        .reduce((n, b) => n + b.quantity, 0);
      const quarantine = bs
        .filter((b) => b.condition !== "sellable")
        .reduce((n, b) => n + b.quantity, 0);
      const reserved = d.reservations
        .filter((r) => r.variantId === v.id && r.locationId === loc.id)
        .reduce((n, r) => n + r.quantity, 0);
      const ss = saleMap.get(k) || [];
      const last = ss.reduce<string | null>(
        (a, s) => (!a || s.date > a ? s.date : a),
        null,
      );
      const recent = ss.filter(
        (s) => s.date >= dayBefore(d.asOf, 28) && s.date < d.asOf,
      );
      const sold = recent.reduce((n, s) => n + s.quantity, 0);
      const deltas = moveMap.get(k) || {};
      let close = sellable - (deltas[d.asOf] || 0),
        exposure = 0,
        stockoutDays = 0;
      for (let n = 1; n <= 28; n++) {
        const day = dayBefore(d.asOf, n);
        const traded = recent.some((s) => s.date === day);
        if (close > 0 || traded) exposure++;
        else stockoutDays++;
        close -= deltas[day] || 0;
      }
      const available = Math.max(0, sellable - reserved),
        rate = exposure ? sold / exposure : 0;
      out.push({
        id: k,
        variantId: v.id,
        productId: v.productId,
        product,
        sku: v.sku,
        size: v.size,
        locationId: loc.id,
        physical,
        sellable,
        excluded: ex,
        quarantine,
        reserved,
        available,
        inTransit: d.transfers
          .filter((t) => t.variantId === v.id && t.destination === loc.id)
          .reduce((n, t) => n + t.inTransit, 0),
        sold,
        rate,
        stockoutDays,
        exposure,
        cover: rate ? available / rate : null,
        status:
          available === 0
            ? "Stockout"
            : rate && available / rate < 14
              ? "Low stock"
              : "Healthy",
        lastSale: last,
      });
    }
  }
  inventoryCache.set(d, out);
  return out;
}
export function filterInventory(
  d: Dataset,
  f: Filters,
  s: Settings = defaults,
) {
  return inventoryRows(d)
    .map((r) => ({
      ...r,
      status:
        r.available === 0
          ? "Stockout"
          : r.cover !== null && r.cover < (s.peak ? s.peakCover : s.cover)
            ? "Low stock"
            : "Healthy",
    }))
    .filter(
      (r) =>
        productMatches(r.product, { ...f, q: undefined }) &&
        (!f.q ||
          `${r.product.name} ${r.sku}`
            .toLowerCase()
            .includes(f.q.toLowerCase())) &&
        (!f.location || r.locationId === f.location) &&
        (!f.channel ||
          (f.channel === "Ecommerce"
            ? r.locationId === "HO"
            : r.locationId !== "HO")) &&
        (!f.size || r.size === f.size) &&
        (!f.status ||
          (f.status === "Selling stockout"
            ? r.available === 0 && r.sold > 0
            : f.status === "Inactive"
              ? r.available > 0 &&
                (r.lastSale
                  ? r.lastSale < dayBefore(d.asOf, s.deadDays)
                  : r.product.launchDate <= dayBefore(d.asOf, s.deadDays))
              : r.status === f.status)),
    );
}
export function recommend(d: Dataset, s: Settings): Recommendation[] {
  const rows = inventoryRows(d),
    cover = s.peak ? s.peakCover : s.cover;
  const pools = new Map(rows.map((r) => [r.id, r.available]));
  const plans: Recommendation[] = [];
  const recipients = rows
    .filter(
      (r) =>
        r.locationId !== "HO" &&
        r.product.category !== "Dupattas" &&
        r.rate > 0,
    )
    .sort(
      (a, b) =>
        (a.cover ?? 0) - (b.cover ?? 0) ||
        b.rate - a.rate ||
        a.id.localeCompare(b.id),
    );
  for (const r of recipients) {
    const arrivals = d.transfers
      .filter(
        (t) =>
          t.variantId === r.variantId &&
          t.destination === r.locationId &&
          t.eta <= dayBefore(d.asOf, -(cover + 3)),
      )
      .reduce((n, t) => n + t.inTransit, 0);
    const target = Math.max(s.minimum, Math.ceil(r.rate * (cover + 3)));
    let gap = Math.max(0, target - r.available - arrivals);
    const ho = rows.find(
      (a) => a.variantId === r.variantId && a.locationId === "HO",
    )!;
    const sources = [
      ho,
      ...rows
        .filter(
          (a) =>
            a.variantId === r.variantId &&
            a.locationId !== "HO" &&
            a.locationId !== r.locationId,
        )
        .sort((a, b) => b.available - a.available),
    ];
    for (const source of sources) {
      if (!gap) break;
      const protection = Math.max(
        s.minimum,
        Math.ceil(source.rate * (cover + 3)),
      );
      const excess = Math.max(0, (pools.get(source.id) || 0) - protection);
      const quantity = Math.min(excess, gap);
      if (!quantity) continue;
      pools.set(source.id, (pools.get(source.id) || 0) - quantity);
      gap -= quantity;
      plans.push({
        id: `${source.id}>${r.locationId}`,
        variantId: r.variantId,
        productId: r.productId,
        size: r.size,
        source: source.locationId,
        destination: r.locationId,
        quantity,
        rate: r.rate,
        available: r.available,
        incoming: arrivals,
        target,
        leadDays: 3,
        kind: source.locationId === "HO" ? "Replenish" : "Rotate",
        reason: `${cover} days cover + 3 days assumed lead time. Target ${target}; ${r.available} available and ${arrivals} arriving. Enough stock is kept at the sending location; the same units are never suggested twice.`,
      });
    }
  }
  return plans;
}
export function optionHealth(d: Dataset, loc: string, s: Settings) {
  const rows = inventoryRows(d);
  return d.products
    .filter((p) => p.category !== "Dupattas")
    .map((p) => {
      const rr = rows.filter(
        (r) => r.locationId === loc && r.productId === p.id,
      );
      const core = s.coreSizes.filter((size) => p.sizes.includes(size));
      const missing = core.filter(
        (size) => (rr.find((r) => r.size === size)?.available || 0) < s.minimum,
      );
      const sold = rr.reduce((n, r) => n + r.sold, 0);
      const current = rr.reduce((n, r) => n + r.available, 0);
      const end = dayBefore(d.asOf, 1),
        start = dayBefore(d.asOf, 30);
      const units = d.sales
        .filter(
          (x) =>
            x.productId === p.id &&
            x.locationId === loc &&
            x.date >= start &&
            x.date <= end,
        )
        .reduce((n, x) => n + x.quantity, 0);
      const delta = d.movements
        .filter(
          (m) =>
            m.locationId === loc &&
            m.variantId.startsWith(p.id + "-") &&
            m.condition === "sellable" &&
            !d.bins.find((b) => b.id === m.binId)?.excluded &&
            m.date >= start,
        )
        .reduce((n, m) => n + m.quantity, 0);
      const additions = d.movements
        .filter(
          (m) =>
            m.locationId === loc &&
            m.variantId.startsWith(p.id + "-") &&
            m.condition === "sellable" &&
            m.date >= start &&
            m.date <= end &&
            m.quantity > 0 &&
            !d.bins.find((b) => b.id === m.binId)?.excluded,
        )
        .reduce((n, m) => n + m.quantity, 0);
      const denominator =
        Math.max(0, rr.reduce((n, r) => n + r.sellable, 0) - delta) + additions;
      const sellthrough = denominator
        ? Math.min(100, (units / denominator) * 100)
        : 0;
      const evidence = rr.some((r) => r.exposure >= 14);
      return {
        productId: p.id,
        healthy: core.length > 0 && missing.length === 0,
        missing,
        product: p,
        sold,
        current,
        sellthrough,
        classification: !evidence
          ? "Insufficient data"
          : sellthrough >= s.hit
            ? "Hit"
            : sellthrough >= s.average
              ? "Average"
              : "Miss",
        fresh:
          p.season === "Festive 2026" &&
          p.launchDate >= dayBefore(d.asOf, s.freshDays),
      };
    });
}
export function trend(d: Dataset, p: string, days: number, f: Filters) {
  const currentStart = dayBefore(d.asOf, days),
    currentEnd = dayBefore(d.asOf, 1),
    previousStart = dayBefore(d.asOf, days * 2),
    previousEnd = dayBefore(d.asOf, days + 1);
  const sales = filterSales(d, {
    ...f,
    from: previousStart,
    to: currentEnd,
  }).filter((s) => s.productId === p);
  const current = sales
      .filter((s) => s.date >= currentStart)
      .reduce((n, s) => n + s.quantity, 0),
    previous = sales
      .filter((s) => s.date <= previousEnd)
      .reduce((n, s) => n + s.quantity, 0);
  return {
    currentStart,
    currentEnd,
    previousStart,
    previousEnd,
    current,
    previous,
    change: previous ? ((current - previous) / previous) * 100 : null,
  };
}
export function priceBands(sales: SalesLine[]) {
  const bands = [
    { name: "Under ₹3k", min: 0, max: 300000, units: 0 },
    { name: "₹3k–5k", min: 300000, max: 500000, units: 0 },
    { name: "₹5k–7k", min: 500000, max: 700000, units: 0 },
    { name: "₹7k+", min: 700000, max: Infinity, units: 0 },
  ];
  for (const s of sales) {
    if (s.netValue === null || s.quantity <= 0) continue;
    const price = s.netValue / s.quantity;
    const b = bands.find((b) => price >= b.min && price < b.max);
    if (b) b.units += s.quantity;
  }
  return bands;
}
export function csv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const keys = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    let str = String(v ?? "");
    if (/^[=+@\-\t\r]/.test(str)) str = "'" + str;
    return /[",\n\r]/.test(str) ? '"' + str.replaceAll('"', '""') + '"' : str;
  };
  return (
    "\ufeff" +
    [
      keys.map(escape).join(","),
      ...rows.map((r) => keys.map((k) => escape(r[k])).join(",")),
    ].join("\r\n")
  );
}
export function exportCsv(rows: Record<string, unknown>[], name: string) {
  const blob = new Blob([csv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name + ".csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function series(sales: SalesLine[]) {
  const by = new Map<
    string,
    { date: string; units: number; revenue: number }
  >();
  for (const s of sales) {
    const a = by.get(s.date) || { date: s.date, units: 0, revenue: 0 };
    a.units += s.quantity;
    a.revenue += s.netValue || 0;
    by.set(s.date, a);
  }
  return [...by.values()].sort((a, b) => a.date.localeCompare(b.date));
}
export function attributes(
  d: Dataset,
  sales: SalesLine[],
  attribute: keyof Product,
) {
  const by = new Map<
    string,
    { name: string; units: number; revenue: number; styles: Set<string> }
  >();
  for (const s of sales) {
    const p = d.products.find((p) => p.id === s.productId)!;
    const name = String(p[attribute]);
    const a = by.get(name) || {
      name,
      units: 0,
      revenue: 0,
      styles: new Set<string>(),
    };
    a.units += s.quantity;
    a.revenue += s.netValue || 0;
    a.styles.add(p.id);
    by.set(name, a);
  }
  return [...by.values()]
    .map((a) => ({
      ...a,
      styles: a.styles.size,
      perOption: a.units / a.styles.size,
    }))
    .sort((a, b) => b.units - a.units);
}
export function dupattaAnalysis(d: Dataset, f: Filters) {
  const sales = filterSales(d, f);
  const inv = filterInventory(d, { ...f, category: undefined });
  const dupattaInv = filterInventory(d, {
    location: f.location,
    channel: f.channel,
  });
  const pools = new Map<string, number>();
  for (const r of dupattaInv.filter((r) => r.product.category === "Dupattas"))
    pools.set(r.productId, (pools.get(r.productId) || 0) + r.available);
  return d.matchingRelationships
    .filter((m) =>
      productMatches(
        d.products.find((p) => p.id === m.outfitId)!,
        { ...f, category: undefined },
      ),
    )
    .map((m) => {
      const p = d.products.find((p) => p.id === m.outfitId)!,
        dupatta = d.products.find((p) => p.id === m.dupattaId)!;
      const ss = sales.filter((s) => s.productId === m.outfitId);
      const withUnits = ss
          .filter((s) => s.matchingStatus === "with")
          .reduce((n, s) => n + s.quantity, 0),
        without = ss
          .filter((s) => s.matchingStatus === "without")
          .reduce((n, s) => n + s.quantity, 0),
        unknown = ss
          .filter((s) => s.matchingStatus === "unknown")
          .reduce((n, s) => n + s.quantity, 0);
      const outfits = inv
        .filter((r) => r.productId === m.outfitId)
        .reduce((n, r) => n + r.available, 0);
      const matched = Math.min(outfits, pools.get(m.dupattaId) || 0);
      pools.set(m.dupattaId, (pools.get(m.dupattaId) || 0) - matched);
      return {
        id: m.outfitId,
        product: p,
        dupatta,
        withUnits,
        without,
        unknown,
        attachment:
          withUnits + without
            ? (withUnits / (withUnits + without)) * 100
            : null,
        outfits,
        matched,
        shortage: outfits - matched,
        coverage: outfits ? (matched / outfits) * 100 : null,
      };
    });
}
