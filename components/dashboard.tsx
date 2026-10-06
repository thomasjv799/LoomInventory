"use client";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  Boxes,
  Store,
  ChartNoAxesCombined,
  PackagePlus,
  CalendarDays,
  Layers,
  Settings2,
  Search,
  SlidersHorizontal,
  Download,
  ArrowUpRight,
  ArrowRight,
  Menu,
  X,
  Sparkles,
  CheckCircle2,
  TriangleAlert,
  Clock3,
  ChevronDown,
  RotateCcw,
  Info,
  PackageOpen,
} from "lucide-react";
import * as Switch from "@radix-ui/react-switch";
import type { ColumnDef } from "@tanstack/react-table";
import type {
  Dataset,
  Product,
  Filters,
  Settings,
  InventoryRow,
  Recommendation,
} from "@/lib/types";
import { fixtureProvider } from "@/lib/provider";
import {
  defaults,
  inventoryRows,
  filterInventory,
  filterSales,
  productMatches,
  recommend,
  optionHealth,
  trend,
  priceBands,
  series,
  attributes,
  dupattaAnalysis,
  money,
  number,
  dayBefore,
  exportCsv,
} from "@/lib/analytics";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { ProductImage } from "./product-image";
import { DataTable } from "./data-table";
import { ReportChart } from "./charts";
const views = [
  { id: "overview", name: "Overview", icon: LayoutDashboard },
  { id: "inventory", name: "Inventory", icon: Boxes },
  { id: "stores", name: "Stores & Rotation", icon: Store },
  { id: "sales", name: "Sales & Attributes", icon: ChartNoAxesCombined },
  { id: "replenishment", name: "Replenishment & Forecasts", icon: PackagePlus },
  { id: "events", name: "Events & Influencers", icon: CalendarDays },
  { id: "dupatta", name: "Dupatta Analysis", icon: Layers },
  { id: "settings", name: "Settings", icon: Settings2 },
];
const titles: Record<string, [string, string]> = {
  overview: ["Overview", "Stock health, shortages and priority actions."],
  inventory: ["Inventory", "Available stock by style, size and location."],
  stores: ["Stores & Rotation", "Store stock health and feasible transfers."],
  sales: ["Sales & Attributes", "Sales by attribute, selling price and size."],
  replenishment: [
    "Replenishment & Forecasts",
    "Stock suggestions, lead times and seasonal demand.",
  ],
  events: [
    "Events & Influencers",
    "Seasonal dates and fictional creator activity alongside sales.",
  ],
  dupatta: [
    "Dupatta Analysis",
    "Matching demand, stock coverage and shortages.",
  ],
  settings: ["Settings", "Demo thresholds and replenishment assumptions."],
};
const sum = <T,>(a: T[], fn: (r: T) => number) =>
  a.reduce((n, r) => n + fn(r), 0);
const unique = (a: string[]) => [...new Set(a)].sort();
const statusTone = (s: string) =>
  s === "Healthy" || s === "Hit"
    ? "green"
    : s === "Stockout" || s === "Miss"
      ? "red"
      : "amber";
function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return (
    <span className={"badge " + tone}>
      {tone === "green" ? (
        <CheckCircle2 size={11} />
      ) : tone === "red" ? (
        <TriangleAlert size={11} />
      ) : tone === "amber" ? (
        <Clock3 size={11} />
      ) : null}
      {children}
    </span>
  );
}
function Panel({
  title,
  subtitle,
  children,
  action,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={"panel " + className}>
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
function Select({
  label,
  value = "",
  onChange,
  options,
}: {
  label: string;
  value?: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="select-label">
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown size={13} />
    </label>
  );
}
export default function Dashboard() {
  const params = useSearchParams();
  const raw = params.get("view") || "overview";
  const view = views.some((v) => v.id === raw) ? raw : "overview";
  const [data, setData] = useState<Dataset | null>(null),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  const [settings, setSettings] = useState<Settings>(defaults),
    [ready, setReady] = useState(false);
  const [mobile, setMobile] = useState(false),
    [expanded, setExpanded] = useState(false),
    [matrix, setMatrix] = useState(false);
  const [product, setProduct] = useState<Product | null>(null),
    [detail, setDetail] = useState<Recommendation | null>(null),
    [toast, setToast] = useState("");
  const focusReturn = useRef<HTMLElement | null>(null);
  const returnRow = useRef<{
    report: string;
    row: string;
    button: number;
  } | null>(null);
  const rememberFocus = (element: HTMLElement) => {
    focusReturn.current = element;
    const row = element.closest("tr"),
      report = element.closest("[data-report]");
    returnRow.current =
      row && report
        ? {
            report: report.getAttribute("data-report")!,
            row: row.getAttribute("data-row-id")!,
            button: Array.from(row.querySelectorAll("button")).indexOf(
              element as HTMLButtonElement,
            ),
          }
        : null;
  };
  useEffect(() => {
    fixtureProvider
      .load()
      .then(setData)
      .catch(() =>
        setError("The demo catalogue could not be loaded. Please retry."),
      );
  }, [retry]);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("loom-settings") || "null");
      if (saved) setSettings({ ...defaults, ...saved });
    } catch {}
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) localStorage.setItem("loom-settings", JSON.stringify(settings));
  }, [settings, ready]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(id);
  }, [toast]);
  const filters: Filters = useMemo(() => {
    const o: Filters = {};
    for (const k of [
      "location",
      "channel",
      "from",
      "to",
      "q",
      "category",
      "size",
      "fabric",
      "color",
      "craft",
      "status",
    ] as (keyof Filters)[]) {
      const val = params.get(k);
      if (val) o[k] = val;
    }
    if (!o.from) o.from = "2026-09-08";
    if (!o.to) o.to = "2026-10-05";
    return o;
  }, [params]);
  const update = useCallback((changes: Record<string, string | undefined>) => {
    const p = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(changes)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    window.history.pushState(null, "", "/?" + p.toString());
  }, []);
  const navigate = (
    id: string,
    extra: Record<string, string | undefined> = {},
  ) => {
    update({ view: id, ...extra });
    setMobile(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const openProduct = (p: Product, opener?: HTMLElement) => {
    rememberFocus(opener || (document.activeElement as HTMLElement));
    setDetail(null);
    setProduct(p);
  };
  const restore = (e: Event) => {
    e.preventDefault();
    if (focusReturn.current?.isConnected) focusReturn.current.focus();
    else if (returnRow.current) {
      const r = returnRow.current;
      document
        .querySelector(
          `[data-report="${CSS.escape(r.report)}"] tr[data-row-id="${CSS.escape(r.row)}"]`,
        )
        ?.querySelectorAll("button")
        [r.button]?.focus();
    }
  };
  const rows = useMemo(
    () => (data ? filterInventory(data, filters, settings) : []),
    [data, filters, settings],
  );
  const sales = useMemo(
    () => (data ? filterSales(data, filters) : []),
    [data, filters],
  );
  const plans = useMemo(
    () =>
      data
        ? recommend(data, settings).filter(
            (r) =>
              productMatches(
                data.products.find((p) => p.id === r.productId)!,
                filters,
              ) &&
              (!filters.location || r.destination === filters.location) &&
              (!filters.size || r.size === filters.size) &&
              (!filters.q ||
                `${data.products.find((p) => p.id === r.productId)!.name} ${data.products.find((p) => p.id === r.productId)!.sku}-${r.size}`
                  .toLowerCase()
                  .includes(filters.q.toLowerCase())) &&
              filters.channel !== "Ecommerce" &&
              (!filters.status ||
                filterInventory(data, filters, settings).some(
                  (x) =>
                    x.variantId === r.variantId &&
                    x.locationId === r.destination,
                )),
          )
        : [],
    [data, settings, filters],
  );
  const prodCell = (p: Product, meta?: string) => (
    <button
      className="product-cell"
      onClick={(e) => openProduct(p, e.currentTarget)}
    >
      <ProductImage product={p} />
      <span>
        <strong>{p.name}</strong>
        <small>{meta || p.sku + " · " + p.fabric}</small>
      </span>
    </button>
  );
  const location = (id: string) =>
    data?.locations.find((l) => l.id === id)?.name || id;
  const productCols: ColumnDef<InventoryRow, any>[] = [
    {
      id: "product",
      accessorFn: (r) => r.product.name,
      header: "Product / SKU",
      cell: ({ row }) => prodCell(row.original.product, row.original.sku),
    },
    { accessorKey: "size", header: "Size" },
    {
      id: "location",
      accessorFn: (r) => location(r.locationId),
      header: "Location",
    },
    {
      accessorKey: "available",
      header: "Available",
      cell: ({ getValue }) => <strong>{number(getValue())}</strong>,
    },
    {
      id: "hoSupply",
      header: "HO available",
      accessorFn: (r) =>
        inventoryRows(data!).find(
          (x) => x.variantId === r.variantId && x.locationId === "HO",
        )!.available,
    },
    { accessorKey: "inTransit", header: "In transit" },
    { accessorKey: "excluded", header: "Excluded" },
    { accessorKey: "quarantine", header: "QC hold" },
    { accessorKey: "sold", header: "Sold · 28d" },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ getValue }) => (
        <Badge tone={statusTone(getValue())}>{getValue()}</Badge>
      ),
    },
  ];
  const planCols: ColumnDef<Recommendation, any>[] = [
    {
      id: "product",
      accessorFn: (r) => data?.products.find((p) => p.id === r.productId)?.name,
      header: "Recommendation",
      cell: ({ row }) =>
        prodCell(
          data!.products.find((p) => p.id === row.original.productId)!,
          row.original.kind + " · " + row.original.size,
        ),
    },
    { id: "source", accessorFn: (r) => location(r.source), header: "From" },
    {
      id: "destination",
      accessorFn: (r) => location(r.destination),
      header: "To",
    },
    { accessorKey: "quantity", header: "Units" },
    { accessorKey: "leadDays", header: "Lead days" },
    {
      id: "rationale",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <Button
          size="sm"
          onClick={() => {
            rememberFocus(document.activeElement as HTMLElement);
            setDetail(row.original);
          }}
        >
          Why this?
          <ArrowUpRight size={13} />
        </Button>
      ),
    },
  ];
  const calendarYear = params.get("year") || "2026";
  const relevantProducts =
    data?.products.filter((p) => productMatches(p, filters)) || [];
  const dead = rows.filter(
    (r) =>
      r.available > 0 &&
      (r.lastSale
        ? r.lastSale < dayBefore(data!.asOf, settings.deadDays)
        : r.product.launchDate <= dayBefore(data!.asOf, settings.deadDays)),
  );
  const short = rows.filter((r) => r.available === 0 && r.sold > 0);
  const hoShort = short.filter((r) => r.locationId === "HO");
  const health = data
    ? data.locations
        .filter(
          (l) =>
            l.id !== "HO" &&
            (!filters.location || l.id === filters.location) &&
            filters.channel !== "Ecommerce",
        )
        .map((l) => ({
          location: l,
          options: optionHealth(data, l.id, settings).filter((o) =>
            productMatches(o.product, filters),
          ),
        }))
    : [];
  const broken = sum(health, (h) => h.options.filter((o) => !o.healthy).length);
  const exportRows = () => {
    if (!data) return;
    let report: Record<string, unknown>[] = [];
    if (view === "inventory")
      report = rows.map((r) => ({
        SKU: r.sku,
        Size: r.size,
        Location: location(r.locationId),
        Physical: r.physical,
        Available: r.available,
        Transit: r.inTransit,
        Excluded: r.excluded,
        Quarantine: r.quarantine,
        Reserved: r.reserved,
        Sold28: r.sold,
        Status: r.status,
      }));
    else if (view === "stores")
      report = health
        .flatMap((h) =>
          h.options.map((o) => ({
            Store: h.location.name,
            SKU: o.product.sku,
            Healthy: o.healthy,
            Missing: o.missing.join(" / "),
            Fresh: o.fresh,
            Class: o.classification,
            SellThrough: o.sellthrough,
            Units: o.current,
          })),
        )
        .concat(
          plans
            .filter((p) => p.kind === "Rotate")
            .map((p) => ({
              Store: location(p.destination),
              SKU: data.products.find((x) => x.id === p.productId)!.sku,
              Healthy: false,
              Missing: p.size,
              Fresh: false,
              Class: "Rotation from " + location(p.source),
              SellThrough: 0,
              Units: p.quantity,
            })),
        );
    else if (view === "replenishment")
      report = plans.map((p) => ({
        SKU: data.products.find((x) => x.id === p.productId)!.sku,
        Size: p.size,
        From: location(p.source),
        To: location(p.destination),
        Units: p.quantity,
        Target: p.target,
        LeadDays: p.leadDays,
        Rationale: p.reason,
      }));
    else if (view === "dupatta")
      report = dupattaAnalysis(data, filters).map((r) => ({
        Outfit: r.product.sku,
        Dupatta: r.dupatta.sku,
        With: r.withUnits,
        Without: r.without,
        Unknown: r.unknown,
        Attachment: r.attachment,
        Outfits: r.outfits,
        Allocated: r.matched,
        Shortage: r.shortage,
      }));
    else if (view === "events")
      report = [
        ...data.events
          .filter((e) => e.start.startsWith(calendarYear))
          .map((e) => ({
            Type: "Seasonal window",
            Name: e.name,
            Date: e.start,
            End: e.end,
            SKU: "",
          })),
        ...data.influencers
          .filter(
            (i) =>
              i.date >= filters.from! &&
              i.date <= filters.to! &&
              relevantProducts.some((p) => p.id === i.productId),
          )
          .map((i) => ({
            Type: i.type,
            Name: i.name,
            Date: i.date,
            End: i.date,
            SKU: data.products.find((p) => p.id === i.productId)!.sku,
          })),
      ];
    else if (view === "sales")
      report = sales.map((s) => ({
        Date: s.date,
        SKU: data.variants.find((v) => v.id === s.variantId)!.sku,
        Location: location(s.locationId),
        Channel: s.channel,
        Quantity: s.quantity,
        TransactionMRP: s.mrp === null ? "Unavailable" : s.mrp / 100,
        ActualNetValue: s.netValue === null ? "Unavailable" : s.netValue / 100,
      }));
    else
      report = attention.map((r) => ({
        SKU: r.product.sku,
        Location: r.where,
        Signal: r.signal,
        Units: r.units,
        Action: r.action,
      }));
    if (!report.length) {
      setToast("No rows to export for this selection.");
      return;
    }
    exportCsv(report, "loom-" + view + "-2026-10-06");
    setToast("Filtered report exported as CSV.");
  };
  const attention = data
    ? [
        ...short.map((r) => ({
          id: r.id,
          product: r.product,
          where: location(r.locationId),
          signal:
            r.locationId === "HO" ? "HO size sold out" : "Store size sold out",
          units: r.sold,
          action:
            r.locationId === "HO"
              ? "Review production"
              : "Review replenishment",
          target: "replenishment",
          size: r.size,
        })),
        ...dead
          .filter(
            (r, i, a) =>
              a.findIndex(
                (x) =>
                  x.productId === r.productId && x.locationId === r.locationId,
              ) === i,
          )
          .map((r) => ({
            id: r.id,
            product: r.product,
            where: location(r.locationId),
            signal: "No sale in " + settings.deadDays + " days",
            units: rows
              .filter(
                (x) =>
                  x.productId === r.productId && x.locationId === r.locationId,
              )
              .reduce((n, x) => n + x.available, 0),
            action: "Review held stock",
            target: "inventory",
            size: undefined,
          })),
      ]
    : [];
  const trends = data
    ? relevantProducts.map((p) => ({
        product: p,
        up: trend(data, p.id, 7, filters),
        down: trend(data, p.id, 10, filters),
      }))
    : [];
  const Nav = ({ inDialog = false }: { inDialog?: boolean }) => (
    <div className="sidebar-inner">
      <a
        href="/?view=overview"
        className="brand"
        aria-label="The Loom Inventory Studio"
      >
        <span className="brand-title">
          the loom<span className="brand-dot">.</span>
        </span>
        <span className="brand-caption">INVENTORY STUDIO</span>
      </a>
      <div className="workspace-label">
        WORKSPACE <span>DEMO</span>
      </div>
      <nav aria-label={inDialog ? "Mobile navigation" : "Main navigation"}>
        {views.map((v) => (
          <a
            key={v.id}
            href={
              "/?" +
              new URLSearchParams({
                ...Object.fromEntries(params),
                view: v.id,
              }).toString()
            }
            onClick={(e) => {
              e.preventDefault();
              navigate(v.id);
            }}
            aria-current={view === v.id ? "page" : undefined}
            className={"nav-item " + (view === v.id ? "active" : "")}
          >
            <v.icon size={18} />
            <span>{v.name}</span>
            {view === v.id && <span className="active-dot" />}
          </a>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="season-note">
          <Sparkles size={16} />
          <strong>Festive, with foresight.</strong>
          <p>Make room for what comes next.</p>
          <button onClick={() => navigate("replenishment")}>
            Explore projections <ArrowRight size={13} />
          </button>
        </div>
        <div className="user">
          <span className="avatar">AM</span>
          <div>
            <strong>Assortment Manager</strong>
            <small>Demo workspace</small>
          </div>
        </div>
      </div>
    </div>
  );
  if (error)
    return (
      <main className="loading-screen">
        <TriangleAlert />
        <p>{error}</p>
        <Button
          onClick={() => {
            setError("");
            setRetry((n) => n + 1);
          }}
        >
          Retry loading
        </Button>
      </main>
    );
  if (!data)
    return (
      <main className="loading-screen" aria-busy="true">
        <span className="brand-title">the loom.</span>
        <p>Preparing your inventory studio…</p>
        <div className="skeleton-bar" />
      </main>
    );
  const periods = [
    { value: "7", label: "Last 7 days" },
    { value: "28", label: "Last 28 days" },
    { value: "90", label: "Last 90 days" },
    { value: "730", label: "24 months" },
    { value: "custom", label: "Custom dates" },
  ];
  const period =
    periods.find(
      (p) =>
        p.value !== "custom" &&
        filters.from === dayBefore(data.asOf, Number(p.value)) &&
        filters.to === dayBefore(data.asOf, 1),
    )?.value || "custom";
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Nav />
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div className="breadcrumb">
            <Button
              className="mobile-menu"
              size="icon"
              aria-label="Open navigation"
              onClick={() => {
                rememberFocus(document.activeElement as HTMLElement);
                setMobile(true);
              }}
            >
              <Menu size={18} />
            </Button>
            <span>Workspace</span>
            <span className="crumb-separator">/</span>
            <strong>{views.find((v) => v.id === view)!.name}</strong>
          </div>
          <div className="header-right">
            <span className="demo-dot" /> <span>Synthetic demo</span>
            <span className="header-divider" />
            <span>06 Oct 2026</span>
            <span className="avatar small">AM</span>
          </div>
        </header>
        <main id="main-content">
          <div className="page-heading">
            <div>
              <h1>{titles[view][0]}</h1>
              <p>{titles[view][1]}</p>
            </div>
            {view !== "settings" && (
              <Button onClick={exportRows}>
                <Download size={15} />
                Export report
              </Button>
            )}
          </div>
          <div className="demo-note">
            <Info size={14} />
            <span>
              Prototype · All business data is simulated. Product imagery
              references The Loom’s public catalogue.
            </span>
            <span className="asof">Stock as of 06 Oct 2026</span>
          </div>
          {view !== "settings" && (
            <div className="filters">
              <div className="filter-top">
                <Select
                  label="Store or warehouse"
                  value={filters.location}
                  onChange={(v) => update({ location: v })}
                  options={[
                    { value: "", label: "All locations" },
                    ...data.locations.map((l) => ({
                      value: l.id,
                      label: l.name,
                    })),
                  ]}
                />
                <Select
                  label="Sales channel"
                  value={filters.channel}
                  onChange={(v) => update({ channel: v })}
                  options={[
                    { value: "", label: "All channels" },
                    { value: "Ecommerce", label: "Ecommerce" },
                    { value: "Store", label: "Stores" },
                  ]}
                />
                <Select
                  label="Date period"
                  value={period}
                  onChange={(v) =>
                    v === "custom"
                      ? (setExpanded(true),
                        update({ from: filters.from, to: filters.to }))
                      : update({
                          from: dayBefore(data.asOf, +v),
                          to: dayBefore(data.asOf, 1),
                        })
                  }
                  options={periods}
                />
                <div className="search">
                  <Search size={15} />
                  <input
                    aria-label="Search product or SKU"
                    placeholder="Search style or SKU…"
                    value={filters.q || ""}
                    onChange={(e) => update({ q: e.target.value })}
                  />
                  {filters.q && (
                    <button
                      aria-label="Clear search"
                      onClick={() => update({ q: undefined })}
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
                <Button
                  size="sm"
                  onClick={() => setExpanded(!expanded)}
                  aria-expanded={expanded}
                >
                  <SlidersHorizontal size={14} />
                  Filters
                </Button>
              </div>
              {expanded && (
                <div className="filter-expanded">
                  <Select
                    label="Category"
                    value={filters.category}
                    onChange={(v) => update({ category: v })}
                    options={[
                      { value: "", label: "All categories" },
                      ...unique(data.products.map((p) => p.category)).map(
                        (v) => ({ value: v, label: v }),
                      ),
                    ]}
                  />
                  {(["fabric", "color", "craft"] as const).map((k) => (
                    <Select
                      key={k}
                      label={k}
                      value={filters[k]}
                      onChange={(v) => update({ [k]: v })}
                      options={[
                        { value: "", label: "All " + k + "s" },
                        ...unique(data.products.map((p) => p[k])).map((v) => ({
                          value: v,
                          label: v,
                        })),
                      ]}
                    />
                  ))}
                  <Select
                    label="Size"
                    value={filters.size}
                    onChange={(v) => update({ size: v })}
                    options={[
                      { value: "", label: "All sizes" },
                      ...["XS", "S", "M", "L", "XL", "XXL", "Free"].map(
                        (v) => ({ value: v, label: v }),
                      ),
                    ]}
                  />
                  {(view === "inventory" ||
                    view === "overview" ||
                    view === "replenishment") && (
                    <Select
                      label="Stock status"
                      value={filters.status}
                      onChange={(v) => update({ status: v })}
                      options={[
                        { value: "", label: "All stock statuses" },
                        ...[
                          "Healthy",
                          "Low stock",
                          "Stockout",
                          "Selling stockout",
                          "Inactive",
                        ].map((v) => ({ value: v, label: v })),
                      ]}
                    />
                  )}
                  <label className="date-label">
                    From
                    <input
                      type="date"
                      aria-label="From date"
                      value={filters.from}
                      min={data.historyStart}
                      max={filters.to}
                      onChange={(e) => update({ from: e.target.value })}
                    />
                  </label>
                  <label className="date-label">
                    To
                    <input
                      type="date"
                      aria-label="To date"
                      value={filters.to}
                      min={filters.from}
                      max="2026-10-05"
                      onChange={(e) => update({ to: e.target.value })}
                    />
                  </label>
                  <Button
                    size="sm"
                    onClick={() =>
                      update(
                        Object.fromEntries(
                          [
                            "location",
                            "channel",
                            "q",
                            "category",
                            "size",
                            "fabric",
                            "color",
                            "craft",
                            "status",
                            "from",
                            "to",
                          ].map((k) => [k, undefined]),
                        ),
                      )
                    }
                  >
                    Clear filters
                  </Button>
                </div>
              )}
              <div className="filter-caption">
                {filters.from} — {filters.to} · Sales period. Availability is
                the current demo snapshot; movement rates use the last 28
                complete days.
              </div>
            </div>
          )}
          {view === "overview" && (
            <>
              <div className="metrics">
                <Metric
                  title="Available stock"
                  value={number(sum(rows, (r) => r.available))}
                  note={
                    number(sum(rows, (r) => r.inTransit)) + " units in transit"
                  }
                  icon={Boxes}
                  onClick={() => navigate("inventory", { status: undefined })}
                />
                <Metric
                  title="Selling size stockouts"
                  value={number(short.length)}
                  note={hoShort.length + " in Head Office"}
                  icon={TriangleAlert}
                  tone="red"
                  onClick={() =>
                    navigate("inventory", { status: "Selling stockout" })
                  }
                />
                <Metric
                  title="Broken options"
                  value={number(broken)}
                  note="Across selected store assortments"
                  icon={Layers}
                  tone="amber"
                  onClick={() => navigate("stores")}
                />
                <Metric
                  title="Inactive stock"
                  value={number(sum(dead, (r) => r.available))}
                  note={"No sales for " + settings.deadDays + "+ days · units"}
                  icon={PackageOpen}
                  onClick={() => navigate("inventory", { status: "Inactive" })}
                />
              </div>
              <Panel
                title="Attention required"
                subtitle={
                  attention.length +
                  " signals · selling size shortages and inactive stock"
                }
                action={
                  <span className="live-note">Movement-led snapshot</span>
                }
              >
                <DataTable
                  data={attention}
                  pageSize={5}
                  label="Attention signals"
                  columns={[
                    {
                      id: "product",
                      accessorFn: (r) => r.product.name,
                      header: "Style",
                      cell: ({ row }) =>
                        prodCell(
                          row.original.product,
                          row.original.product.sku +
                            (row.original.size
                              ? " · " + row.original.size
                              : ""),
                        ),
                    },
                    { accessorKey: "where", header: "Location" },
                    {
                      accessorKey: "signal",
                      header: "Signal",
                      cell: ({ getValue }) => (
                        <Badge
                          tone={
                            getValue().includes("sold out") ? "red" : "amber"
                          }
                        >
                          {getValue()}
                        </Badge>
                      ),
                    },
                    {
                      accessorKey: "units",
                      header: "Units",
                      cell: ({ row }) => (
                        <span>
                          {row.original.units}
                          <small className="block-muted">
                            {row.original.signal.includes("sold out")
                              ? "sold · 28d"
                              : "held"}
                          </small>
                        </span>
                      ),
                    },
                    {
                      id: "action",
                      header: "Next step",
                      enableSorting: false,
                      cell: ({ row }) => (
                        <button
                          className="text-button"
                          onClick={() =>
                            navigate(row.original.target, {
                              q: row.original.product.sku,
                              size: row.original.size,
                              status: undefined,
                            })
                          }
                        >
                          {row.original.action}
                          <ArrowUpRight size={13} />
                        </button>
                      ),
                    },
                  ]}
                />
              </Panel>
              <div className="split-grid">
                <Panel
                  title="Sales demand"
                  subtitle={
                    number(sum(sales, (s) => s.quantity)) +
                    " units sold · selected period"
                  }
                  action={
                    <button
                      className="text-button"
                      onClick={() => navigate("sales")}
                    >
                      Explore sales <ArrowUpRight size={13} />
                    </button>
                  }
                >
                  <ReportChart
                    data={series(sales)}
                    x="date"
                    kind="area"
                    label="Daily units sold"
                  />
                </Panel>
                <Panel
                  title="Stock recommendations"
                  subtitle={plans.length + " stock recommendations"}
                >
                  <div className="opportunity-list">
                    {plans.slice(0, 3).map((p) => (
                      <button
                        className="opportunity"
                        key={p.id}
                        onClick={() => {
                          focusReturn.current =
                            document.activeElement as HTMLElement;
                          setDetail(p);
                        }}
                      >
                        <ProductImage
                          product={data.products.find(
                            (x) => x.id === p.productId,
                          )!}
                        />
                        <span>
                          <strong>
                            {p.kind === "Rotate"
                              ? "Rotate excess stock"
                              : "Fill a size gap"}
                          </strong>
                          <p>
                            {
                              data.products.find((x) => x.id === p.productId)!
                                .color
                            }{" "}
                            · {p.size} · {p.quantity} units
                          </p>
                          <small>
                            {location(p.source)} → {location(p.destination)}
                          </small>
                        </span>
                        <ArrowUpRight size={16} />
                      </button>
                    ))}
                    {!plans.length && (
                      <div className="empty-state">
                        No feasible replenishment for these filters.
                      </div>
                    )}
                  </div>
                </Panel>
              </div>
              <div className="split-grid">
                <Panel
                  title="Seven-day increases"
                  subtitle={
                    "Last 7 days versus previous 7 · " +
                    settings.spike +
                    "% threshold"
                  }
                >
                  <TrendList
                    items={trends.filter(
                      (t) =>
                        t.up.change !== null && t.up.change >= settings.spike,
                    )}
                    type="up"
                    renderProduct={prodCell}
                  />
                </Panel>
                <Panel
                  title="Ten-day declines"
                  subtitle={
                    "Last 10 days versus previous 10 · " +
                    settings.drop +
                    "% decline threshold"
                  }
                >
                  <TrendList
                    items={trends.filter(
                      (t) =>
                        t.down.change !== null &&
                        t.down.change <= -settings.drop,
                    )}
                    type="down"
                    renderProduct={prodCell}
                  />
                </Panel>
              </div>
            </>
          )}
          {view === "inventory" && (
            <>
              <div className="metrics three">
                <Metric
                  title="Available to sell"
                  value={number(sum(rows, (r) => r.available))}
                  note="Sellable − reservations; excludes dispatch & QC"
                  icon={Boxes}
                />
                <Metric
                  title="In transit"
                  value={number(sum(rows, (r) => r.inTransit))}
                  note="Retained centrally owned; not yet available"
                  icon={Clock3}
                />
                <Metric
                  title="Excluded & held"
                  value={number(sum(rows, (r) => r.excluded + r.quarantine))}
                  note={
                    sum(rows, (r) => r.excluded) +
                    " dispatch · " +
                    sum(rows, (r) => r.quarantine) +
                    " quarantined"
                  }
                  icon={PackageOpen}
                />
              </div>
              <Panel
                title="Inventory by size and location"
                subtitle={
                  rows.length +
                  " SKU / size / location rows · " +
                  number(sum(rows, (r) => r.physical)) +
                  " physical units"
                }
                action={
                  <div className="segmented">
                    <button
                      aria-pressed={!matrix}
                      onClick={() => setMatrix(false)}
                    >
                      Table
                    </button>
                    <button
                      aria-pressed={matrix}
                      onClick={() => setMatrix(true)}
                    >
                      Size matrix
                    </button>
                  </div>
                }
              >
                {matrix ? (
                  <DataTable
                    data={relevantProducts
                      .map((p) => ({
                        product: p,
                        rr: rows.filter((r) => r.productId === p.id),
                      }))
                      .filter((x) => x.rr.length)}
                    label="Size availability matrix"
                    columns={[
                      {
                        id: "product",
                        accessorFn: (r) => r.product.name,
                        header: "Style",
                        cell: ({ row }) => prodCell(row.original.product),
                      },
                      ...["XS", "S", "M", "L", "XL", "XXL", "Free"]
                        .filter((s) => !filters.size || filters.size === s)
                        .map((size) => ({
                          id: size,
                          accessorFn: (r: { rr: InventoryRow[] }) =>
                            sum(
                              r.rr.filter((x) => x.size === size),
                              (x) => x.available,
                            ),
                          header: size,
                          cell: ({ row, getValue }: any) =>
                            row.original.rr.some(
                              (r: InventoryRow) => r.size === size,
                            ) ? (
                              <span
                                className={getValue() === 0 ? "zero-cell" : ""}
                              >
                                {getValue()}
                              </span>
                            ) : (
                              <span className="muted">—</span>
                            ),
                        })),
                    ]}
                  />
                ) : (
                  <DataTable
                    data={rows}
                    columns={productCols}
                    label="Inventory ledger"
                  />
                )}
                <div className="panel-footnote">
                  Physical includes dispatch and QC hold. Size matrix sums
                  selected locations. Sales deductions appear once through
                  movements.
                </div>
              </Panel>
              <Panel
                title="Held inventory to review"
                subtitle={
                  "No sales for " +
                  settings.deadDays +
                  " days · " +
                  number(sum(dead, (r) => r.available)) +
                  " available units. Review before an outward decision."
                }
              >
                <DataTable
                  data={dead}
                  columns={productCols.slice(0, 7)}
                  label="Inactive inventory"
                  pageSize={4}
                />
              </Panel>
            </>
          )}
          {view === "stores" && (
            <>
              <div className="store-grid">
                {health.map((h) => {
                  const healthy = h.options.filter((o) => o.healthy).length,
                    fresh = sum(
                      h.options.filter((o) => o.fresh),
                      (o) => o.current,
                    ),
                    stock = sum(h.options, (o) => o.current);
                  return (
                    <button
                      key={h.location.id}
                      className="store-card"
                      onClick={() => update({ location: h.location.id })}
                    >
                      <div className="store-card-top">
                        <Store size={18} />
                        <ArrowUpRight size={15} />
                      </div>
                      <h2>{h.location.city}</h2>
                      <p>{h.location.name.split(" · ")[1]}</p>
                      <strong>
                        {healthy}
                        <span> / {h.options.length} healthy options</span>
                      </strong>
                      <div className="progress">
                        <i
                          style={{
                            width:
                              (h.options.length
                                ? (healthy / h.options.length) * 100
                                : 0) + "%",
                          }}
                        />
                      </div>
                      <div className="store-card-footer">
                        <span>{h.options.length - healthy} broken</span>
                        <span>
                          {stock ? Math.round((fresh / stock) * 100) : 0}% fresh
                          stock
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
              <Panel
                title="Assortment health, style by style"
                subtitle="Core size completeness · 30-day sell-through classification. Freshness is share of available outfit units from current-season styles launched within the configured window."
              >
                <DataTable
                  data={health.flatMap((h) =>
                    h.options.map((o) => ({ ...o, store: h.location.name })),
                  )}
                  label="Store option health"
                  columns={[
                    {
                      id: "product",
                      accessorFn: (r) => r.product.name,
                      header: "Style",
                      cell: ({ row }) => prodCell(row.original.product),
                    },
                    { accessorKey: "store", header: "Store" },
                    {
                      accessorKey: "healthy",
                      header: "Size set",
                      cell: ({ row }) => (
                        <Badge tone={row.original.healthy ? "green" : "amber"}>
                          {row.original.healthy
                            ? "Healthy"
                            : settings.coreSizes.length
                              ? "Missing " + row.original.missing.join(", ")
                              : "No core sizes configured"}
                        </Badge>
                      ),
                    },
                    {
                      accessorKey: "fresh",
                      header: "Season",
                      cell: ({ getValue }) =>
                        getValue() ? "New season" : "Previous season",
                    },
                    {
                      accessorKey: "sellthrough",
                      header: "Sell-through",
                      cell: ({ getValue }) => number(getValue()) + "%",
                    },
                    {
                      accessorKey: "classification",
                      header: "Performance",
                      cell: ({ getValue }) => (
                        <Badge tone={statusTone(getValue())}>
                          {getValue()}
                        </Badge>
                      ),
                    },
                  ]}
                />
              </Panel>
              <Panel
                title="Store rotations"
                subtitle="Feasible rotations only · recipient gaps and donor cover are protected. Every shared source unit is allocated once."
              >
                <DataTable
                  data={plans.filter((p) => p.kind === "Rotate")}
                  columns={planCols}
                  label="Store rotation suggestions"
                />
              </Panel>
              <Panel
                title="Slow stock, by store"
                subtitle="Inactive or slow-selling available units. Slow: daily rate at or below the configured threshold."
              >
                <DataTable
                  data={rows.filter(
                    (r) =>
                      r.locationId !== "HO" &&
                      r.available > 0 &&
                      ((r.rate > 0 && r.rate <= settings.slow) ||
                        (r.lastSale
                          ? r.lastSale < dayBefore(data.asOf, settings.deadDays)
                          : r.product.launchDate <=
                            dayBefore(data.asOf, settings.deadDays))),
                  )}
                  columns={productCols.slice(0, 5)}
                  label="Store inactive stock"
                  pageSize={4}
                />
              </Panel>
            </>
          )}
          {view === "sales" && (
            <>
              <div className="metrics three">
                <Metric
                  title="Units sold"
                  value={number(sum(sales, (s) => s.quantity))}
                  note={sales.length + " sales lines in selected period"}
                  icon={ChartNoAxesCombined}
                />
                <Metric
                  title="Actual net revenue"
                  value={money(sum(sales, (s) => s.netValue || 0))}
                  note={
                    sales.filter((s) => s.netValue === null).length +
                    " lines with unavailable selling value excluded"
                  }
                  icon={Store}
                />
                <Metric
                  title="Realised unit price"
                  value={
                    sum(
                      sales.filter((s) => s.netValue !== null),
                      (s) => s.quantity,
                    )
                      ? money(
                          sum(sales, (s) => s.netValue || 0) /
                            sum(
                              sales.filter((s) => s.netValue !== null),
                              (s) => s.quantity,
                            ),
                        )
                      : "Unavailable"
                  }
                  note="Weighted actual net value ÷ priced units"
                  icon={Layers}
                />
              </div>
              <div className="split-grid">
                <Panel
                  title="Actual selling-price bands"
                  subtitle="Actual selling price per unit; suggested MRP is never used."
                >
                  <ReportChart
                    data={priceBands(sales)}
                    label="Units by actual selling-price band"
                  />
                </Panel>
                <Panel
                  title="The size mix"
                  subtitle="Units sold · selected location and period"
                >
                  <ReportChart
                    data={["XS", "S", "M", "L", "XL", "XXL", "Free"].map(
                      (size) => ({
                        name: size,
                        units: sum(
                          sales.filter(
                            (s) =>
                              data.variants.find((v) => v.id === s.variantId)
                                ?.size === size,
                          ),
                          (s) => s.quantity,
                        ),
                      }),
                    )}
                    label="Units sold by size"
                  />
                </Panel>
              </div>
              <div className="split-grid">
                {(["fabric", "craft", "color", "style"] as const).map(
                  (attr) => (
                    <Panel
                      key={attr}
                      title={
                        attr[0].toUpperCase() + attr.slice(1) + " preferences"
                      }
                      subtitle="Units per selling style helps compare differently sized groups."
                    >
                      <DataTable
                        data={attributes(data, sales, attr)}
                        pageSize={4}
                        label={attr + " performance"}
                        columns={[
                          { accessorKey: "name", header: "Attribute" },
                          { accessorKey: "units", header: "Units" },
                          { accessorKey: "styles", header: "Selling styles" },
                          {
                            accessorKey: "perOption",
                            header: "Units / style",
                            cell: ({ getValue }) => number(getValue()),
                          },
                        ]}
                      />
                    </Panel>
                  ),
                )}
              </div>
              <div className="split-grid">
                <Panel
                  title="Seven-day increases"
                  subtitle="Fixed complete-day comparison; zero baselines are unavailable."
                >
                  <TrendList
                    items={trends.filter(
                      (t) =>
                        t.up.change !== null && t.up.change >= settings.spike,
                    )}
                    type="up"
                    renderProduct={prodCell}
                  />
                </Panel>
                <Panel
                  title="Ten-day declines"
                  subtitle="Fixed complete-day comparison across selected locations."
                >
                  <TrendList
                    items={trends.filter(
                      (t) =>
                        t.down.change !== null &&
                        t.down.change <= -settings.drop,
                    )}
                    type="down"
                    renderProduct={prodCell}
                  />
                </Panel>
              </div>
              <Panel
                title="Sales ledger"
                subtitle="Transaction MRP and net value are recorded independently of the product master."
              >
                <DataTable
                  data={sales}
                  label="Sales transactions"
                  columns={[
                    { accessorKey: "date", header: "Date" },
                    {
                      id: "product",
                      accessorFn: (r) =>
                        data.products.find((p) => p.id === r.productId)!.name,
                      header: "Style",
                      cell: ({ row }) =>
                        prodCell(
                          data.products.find(
                            (p) => p.id === row.original.productId,
                          )!,
                          data.variants.find(
                            (v) => v.id === row.original.variantId,
                          )!.sku,
                        ),
                    },
                    {
                      id: "location",
                      accessorFn: (r) => location(r.locationId),
                      header: "Location",
                    },
                    { accessorKey: "quantity", header: "Units" },
                    {
                      accessorKey: "mrp",
                      header: "Transaction MRP",
                      cell: ({ getValue }) =>
                        getValue() === null ? "Unavailable" : money(getValue()),
                    },
                    {
                      accessorKey: "netValue",
                      header: "Net sale value",
                      cell: ({ getValue }) =>
                        getValue() === null ? "Unavailable" : money(getValue()),
                    },
                  ]}
                />
              </Panel>
            </>
          )}
          {view === "replenishment" && (
            <>
              <div className="metrics three">
                <Metric
                  title="Suggested replenishment"
                  value={number(sum(plans, (p) => p.quantity))}
                  note={plans.length + " feasible SKU-size suggestions"}
                  icon={PackagePlus}
                />
                <Metric
                  title="Target cover"
                  value={
                    (settings.peak ? settings.peakCover : settings.cover) +
                    " days"
                  }
                  note="Plus 3-day assumed transfer lead time"
                  icon={Clock3}
                />
                <Metric
                  title="HO selling size shortages"
                  value={hoShort.length.toString()}
                  note="Sizes sold recently with zero availability"
                  icon={TriangleAlert}
                />
              </div>
              <Panel
                title="Fill the gaps with intention"
                subtitle="Suggestions include timely inbound stock. Changing cover settings recomputes this report."
              >
                <DataTable
                  data={plans}
                  columns={planCols}
                  label="Replenishment suggestions"
                />
              </Panel>
              <Panel
                title="Head Office shortages"
                subtitle="Production candidates: recently selling sizes with no HO stock. Quantities are cover-based demonstrations."
              >
                <DataTable
                  data={hoShort}
                  columns={[
                    ...productCols.slice(0, 4),
                    {
                      id: "required",
                      header: "Suggested units",
                      accessorFn: (r) =>
                        Math.ceil(
                          r.rate *
                            (settings.peak
                              ? settings.peakCover
                              : settings.cover),
                        ),
                    },
                    { accessorKey: "sold", header: "Sold · 28d" },
                  ]}
                  label="HO stockout candidates"
                  pageSize={4}
                />
              </Panel>
              <Panel
                title="A view of the coming season"
                subtitle="Precomputed demonstration · 28-day sales × month length × seasonal factor. Size allocations use recent observed mix. Location, channel, date and cover settings do not recalculate these network forecasts."
                action={
                  <div className="panel-actions">
                    <Badge tone="amber">Precomputed</Badge>
                    <Button
                      size="sm"
                      onClick={() => {
                        exportCsv(
                          data.sizeForecasts
                            .filter(
                              (f) =>
                                relevantProducts.some(
                                  (p) => p.id === f.productId,
                                ) &&
                                (!filters.size || f.size === filters.size) &&
                                (!filters.q ||
                                  `${data.products.find((p) => p.id === f.productId)!.name} ${data.products.find((p) => p.id === f.productId)!.sku}-${f.size}`
                                    .toLowerCase()
                                    .includes(filters.q.toLowerCase())),
                            )
                            .map((f) => ({
                              SKU: f.variantId,
                              Month: f.month,
                              PrecomputedUnits: f.units,
                              Factor: f.factor,
                              Method: f.method,
                            })),
                          "loom-precomputed-forecasts",
                        );
                        setToast("Precomputed forecast report exported.");
                      }}
                    >
                      <Download size={12} />
                      CSV
                    </Button>
                  </div>
                }
              >
                <DataTable
                  data={data.sizeForecasts.filter(
                    (f) =>
                      relevantProducts.some((p) => p.id === f.productId) &&
                      (!filters.size || f.size === filters.size) &&
                      (!filters.q ||
                        `${data.products.find((p) => p.id === f.productId)!.name} ${data.products.find((p) => p.id === f.productId)!.sku}-${f.size}`
                          .toLowerCase()
                          .includes(filters.q.toLowerCase())),
                  )}
                  label="Seasonal projections"
                  columns={[
                    {
                      id: "product",
                      accessorFn: (r) =>
                        data.products.find((p) => p.id === r.productId)!.name,
                      header: "Style",
                      cell: ({ row }) =>
                        prodCell(
                          data.products.find(
                            (p) => p.id === row.original.productId,
                          )!,
                        ),
                    },
                    { accessorKey: "size", header: "Size" },
                    { accessorKey: "month", header: "Month" },
                    {
                      accessorKey: "units",
                      header: "Projected units",
                      cell: ({ getValue }) =>
                        getValue() === 0 ? (
                          <span>
                            Unavailable
                            <small className="block-muted">
                              No recent sales baseline
                            </small>
                          </span>
                        ) : (
                          getValue()
                        ),
                    },
                    {
                      accessorKey: "factor",
                      header: "Seasonal factor",
                      cell: ({ getValue }) => getValue() + "×",
                    },
                  ]}
                />
                <div className="panel-footnote">
                  Network demand, not a purchase order. Settings changes do not
                  alter these forecasts. Sparse older history and no lost-sales
                  model limit forecast reliability.
                </div>
              </Panel>
              <Panel
                title="Size packs & stockout evidence"
                subtitle="28-day end-of-day stockout proxy. Pack weights use sales per in-stock day; no sales baseline is marked unavailable."
                action={
                  <Button
                    size="sm"
                    aria-pressed={params.get("fast") === "1"}
                    onClick={() =>
                      update({
                        fast: params.get("fast") === "1" ? undefined : "1",
                      })
                    }
                  >
                    {params.get("fast") === "1"
                      ? "Show all sizes"
                      : "Fast seller stockouts"}
                  </Button>
                }
              >
                <DataTable
                  data={rows.filter(
                    (r) =>
                      r.product.category !== "Dupattas" &&
                      (!params.get("fast") ||
                        (r.rate >= settings.fast && r.stockoutDays > 0)),
                  )}
                  label="Size pack rationalisation"
                  columns={[
                    ...productCols.slice(0, 3),
                    {
                      accessorKey: "rate",
                      header: "Units / in-stock day",
                      cell: ({ getValue }) => number(getValue()),
                    },
                    {
                      accessorKey: "stockoutDays",
                      header: "Stockout days · 28d",
                    },
                    {
                      id: "pack",
                      header: "Size weight",
                      accessorFn: (r) => {
                        const rr = inventoryRows(data).filter(
                          (x) =>
                            x.productId === r.productId &&
                            x.locationId === r.locationId,
                        );
                        const total = sum(rr, (x) => x.rate);
                        return total ? (r.rate / total) * 100 : null;
                      },
                      cell: ({ getValue }) =>
                        getValue() === null
                          ? "Insufficient data"
                          : number(getValue()) + "%",
                    },
                    {
                      id: "nonPeak",
                      header: "Non-peak units",
                      accessorFn: (r) =>
                        r.rate ? Math.ceil(r.rate * settings.cover) : null,
                      cell: ({ getValue }) => getValue() ?? "Unavailable",
                    },
                    {
                      id: "peak",
                      header: "Peak units",
                      accessorFn: (r) =>
                        r.rate ? Math.ceil(r.rate * settings.peakCover) : null,
                      cell: ({ getValue }) => getValue() ?? "Unavailable",
                    },
                  ]}
                />
              </Panel>
              <Panel
                title="Replenished after sales"
                subtitle="Completed receipts in the selected period. Elapsed days are actual fixture dispatch-to-receipt times."
              >
                <DataTable
                  data={data.transfers
                    .filter(
                      (t) =>
                        t.receivedDate &&
                        t.receivedDate >= filters.from! &&
                        t.receivedDate <= filters.to! &&
                        (!filters.location ||
                          t.destination === filters.location) &&
                        (!filters.size ||
                          data.variants.find((v) => v.id === t.variantId)
                            ?.size === filters.size) &&
                        filters.channel !== "Ecommerce" &&
                        relevantProducts.some(
                          (p) =>
                            p.id ===
                            data.variants.find((v) => v.id === t.variantId)
                              ?.productId,
                        ),
                    )
                    .map((t) => ({
                      ...t,
                      size: data.variants.find((v) => v.id === t.variantId)!
                        .size,
                      elapsed: Math.round(
                        (Date.parse(t.receivedDate!) -
                          Date.parse(t.dispatchDate)) /
                          86400000,
                      ),
                      lastSale:
                        data.sales
                          .filter(
                            (x) =>
                              x.variantId === t.variantId &&
                              x.locationId === t.destination &&
                              x.date <= t.dispatchDate,
                          )
                          .sort((a, b) => b.date.localeCompare(a.date))[0]
                          ?.date || "No preceding sale",
                    }))}
                  label="Completed replenishments"
                  columns={[
                    { accessorKey: "variantId", header: "SKU / size" },
                    {
                      id: "destination",
                      accessorFn: (r) => location(r.destination),
                      header: "Store",
                    },
                    {
                      accessorKey: "lastSale",
                      header: "Last sale before issue",
                    },
                    { accessorKey: "received", header: "Received units" },
                    { accessorKey: "receivedDate", header: "Receipt date" },
                    { accessorKey: "elapsed", header: "Elapsed days" },
                  ]}
                />
              </Panel>
              <Panel
                title="Stock on its way"
                subtitle="Partial receipts are tracked; remaining quantities stay unavailable until received."
              >
                <DataTable
                  data={data.transfers.filter(
                    (t) =>
                      t.inTransit > 0 &&
                      (!filters.location ||
                        t.destination === filters.location) &&
                      (!filters.size ||
                        data.variants.find((v) => v.id === t.variantId)
                          ?.size === filters.size) &&
                      relevantProducts.some(
                        (p) =>
                          p.id ===
                          data.variants.find((v) => v.id === t.variantId)
                            ?.productId,
                      ),
                  )}
                  label="In-transit transfers"
                  columns={[
                    { accessorKey: "variantId", header: "SKU / size" },
                    {
                      id: "destination",
                      accessorFn: (r) => location(r.destination),
                      header: "Store",
                    },
                    { accessorKey: "dispatched", header: "Dispatched" },
                    { accessorKey: "received", header: "Received" },
                    { accessorKey: "inTransit", header: "Remaining" },
                    { accessorKey: "eta", header: "Expected receipt" },
                    { accessorKey: "ownership", header: "Ownership" },
                  ]}
                />
              </Panel>
            </>
          )}
          {view === "events" && (
            <>
              <div className="split-grid">
                <Panel
                  title="The seasonal calendar"
                  subtitle="Year calendar independent of the sales period. Festival dates are source referenced; shopping windows and demand multipliers are simulated."
                  action={
                    <Select
                      label="Calendar year"
                      value={calendarYear}
                      onChange={(v) => update({ year: v })}
                      options={[2024, 2025, 2026].map((y) => ({
                        value: String(y),
                        label: String(y),
                      }))}
                    />
                  }
                >
                  <div className="calendar-list">
                    {data.events
                      .filter((e) => e.start.startsWith(calendarYear))
                      .sort((a, b) => a.start.localeCompare(b.start))
                      .map((e) => (
                        <div className="calendar-event" key={e.id}>
                          <span className="calendar-date">
                            {e.start.slice(8)}
                            <small>
                              {new Date(
                                e.start + "T12:00:00",
                              ).toLocaleDateString("en", { month: "short" })}
                            </small>
                          </span>
                          <div>
                            <h3>{e.name}</h3>
                            <p>
                              {e.start} — {e.end}
                            </p>
                            <Badge>{e.kind}</Badge>
                            {e.sourceUrl && (
                              <a
                                href={e.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-button festival-source"
                              >
                                Date source <ArrowUpRight size={11} />
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    {!data.events.some((e) =>
                      e.start.startsWith(calendarYear),
                    ) && (
                      <div className="empty-state">
                        No seasonal windows in the selected period.
                      </div>
                    )}
                  </div>
                </Panel>
                <Panel
                  title="Seen, styled, shared"
                  subtitle="Fictional creator records; timing alone does not establish causation."
                >
                  <div className="creator-list">
                    {data.influencers
                      .filter(
                        (i) =>
                          i.date >= filters.from! &&
                          i.date <= filters.to! &&
                          relevantProducts.some((p) => p.id === i.productId),
                      )
                      .map((i) => (
                        <div key={i.id}>
                          <div className="creator-head">
                            <span className="avatar">
                              {i.name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")}
                            </span>
                            <span>
                              <strong>{i.name}</strong>
                              <small>
                                {i.type} · {i.channel} · {i.date}
                              </small>
                            </span>
                            <Badge>Fictional</Badge>
                          </div>
                          {prodCell(
                            data.products.find((p) => p.id === i.productId)!,
                          )}
                        </div>
                      ))}
                    {!data.influencers.some(
                      (i) =>
                        i.date >= filters.from! &&
                        i.date <= filters.to! &&
                        relevantProducts.some((p) => p.id === i.productId),
                    ) && (
                      <div className="empty-state">
                        No fictional activity in this selection.
                      </div>
                    )}
                  </div>
                </Panel>
              </div>
              <Panel
                title="A timeline, with context"
                subtitle="Daily units with shopping-window and creator overlays. Use a product filter to examine a specific style."
              >
                <ReportChart
                  data={series(sales)}
                  x="date"
                  kind="area"
                  label="Sales timeline with event overlays"
                  events={[
                    ...data.events
                      .filter(
                        (e) => e.end >= filters.from! && e.start <= filters.to!,
                      )
                      .map((e) => ({
                        ...e,
                        start:
                          e.start < filters.from! ? filters.from! : e.start,
                        end: e.end > filters.to! ? filters.to! : e.end,
                      })),
                    ...data.influencers
                      .filter(
                        (i) =>
                          i.date >= filters.from! &&
                          i.date <= filters.to! &&
                          relevantProducts.some((p) => p.id === i.productId),
                      )
                      .map((i) => ({
                        start: i.date,
                        end: i.date,
                        name: i.name,
                      })),
                  ]}
                />
                <div className="panel-footnote">
                  Synthetic sales and fictional activity illustrate association.
                  The prototype does not assign causal sales uplift.
                </div>
              </Panel>
            </>
          )}
          {view === "dupatta" && (
            <>
              <div className="editorial-note">
                <Layers size={22} />
                <div>
                  <h2>A set is more than the sum of its pieces.</h2>
                  <p>
                    Explicit demo mappings connect outfit and standalone dupatta
                    styles. These pairings are simulated, not catalogue claims.
                  </p>
                </div>
              </div>
              <Panel
                title="Matching demand & coverage"
                subtitle="Attachment = with ÷ (with + without), excluding unknown. Shared dupatta availability is allocated once across mapped outfits."
              >
                <DataTable
                  data={dupattaAnalysis(data, filters)}
                  label="Matching dupatta coverage"
                  columns={[
                    {
                      id: "outfit",
                      accessorFn: (r) => r.product.name,
                      header: "Outfit",
                      cell: ({ row }) => prodCell(row.original.product),
                    },
                    {
                      id: "dupatta",
                      accessorFn: (r) => r.dupatta.name,
                      header: "Matching demo dupatta",
                      cell: ({ row }) => prodCell(row.original.dupatta),
                    },
                    {
                      accessorKey: "attachment",
                      header: "Attachment %",
                      cell: ({ getValue }) =>
                        getValue() === null
                          ? "Unavailable"
                          : number(getValue()) + "%",
                    },
                    { accessorKey: "withUnits", header: "With" },
                    { accessorKey: "without", header: "Without" },
                    { accessorKey: "unknown", header: "Unknown" },
                    { accessorKey: "outfits", header: "Outfits available" },
                    { accessorKey: "matched", header: "Pairs covered" },
                    {
                      accessorKey: "shortage",
                      header: "Shortage",
                      cell: ({ getValue }) => (
                        <Badge tone={getValue() ? "amber" : "green"}>
                          {getValue()}
                        </Badge>
                      ),
                    },
                  ]}
                />
              </Panel>
              <Panel
                title="Standalone dupatta inventory"
                subtitle="Free-size stock, available separately from mapped outfit sets."
              >
                <DataTable
                  data={rows.filter((r) => r.product.category === "Dupattas")}
                  columns={productCols}
                  label="Standalone dupatta inventory"
                />
              </Panel>
            </>
          )}
          {view === "settings" && (
            <>
              <div className="settings-layout">
                <Panel
                  title="Stock planning"
                  subtitle="Saved on this device. Supported suggestions update immediately."
                >
                  <div className="settings-fields">
                    {(
                      [
                        [
                          "cover",
                          "Non-peak stock cover",
                          "Days of availability to maintain",
                          1,
                          90,
                        ],
                        [
                          "peakCover",
                          "Peak stock cover",
                          "Days to maintain during peak season",
                          1,
                          120,
                        ],
                        [
                          "minimum",
                          "Minimum core-size stock",
                          "Units required for a healthy size",
                          1,
                          20,
                        ],
                        [
                          "deadDays",
                          "Inactive stock window",
                          "Days without a sale before review",
                          14,
                          365,
                        ],
                      ] as const
                    ).map(([key, label, help, min, max]) => (
                      <SettingInput
                        key={key}
                        label={label}
                        help={help}
                        value={settings[key]}
                        step={1}
                        min={min}
                        max={max}
                        onChange={(v) =>
                          setSettings((s) => ({ ...s, [key]: v }))
                        }
                      />
                    ))}
                    <div className="setting-row">
                      <div>
                        <label htmlFor="peak-mode">Peak season mode</label>
                        <small>Use peak cover for replenishment</small>
                      </div>
                      <Switch.Root
                        id="peak-mode"
                        className="switch"
                        checked={settings.peak}
                        onCheckedChange={(v) =>
                          setSettings((s) => ({ ...s, peak: v }))
                        }
                      >
                        <Switch.Thumb className="switch-thumb" />
                      </Switch.Root>
                    </div>
                    <fieldset className="core-sizes">
                      <legend>Core sizes for a healthy option</legend>
                      {["XS", "S", "M", "L", "XL", "XXL"].map((size) => (
                        <label key={size}>
                          <input
                            type="checkbox"
                            checked={settings.coreSizes.includes(size)}
                            onChange={(e) =>
                              setSettings((s) => ({
                                ...s,
                                coreSizes: e.target.checked
                                  ? [...s.coreSizes, size]
                                  : s.coreSizes.filter((x) => x !== size),
                              }))
                            }
                          />
                          {size}
                        </label>
                      ))}
                    </fieldset>
                  </div>
                </Panel>
                <Panel
                  title="Classification & signals"
                  subtitle="Thresholds are demonstration choices, not The Loom policies."
                >
                  <div className="settings-fields">
                    {(
                      [
                        [
                          "spike",
                          "Seven-day increase threshold",
                          "Percentage increase versus prior 7 days",
                          1,
                          500,
                        ],
                        [
                          "drop",
                          "Ten-day decline threshold",
                          "Percentage drop versus prior 10 days",
                          1,
                          100,
                        ],
                        [
                          "hit",
                          "Hit sell-through threshold",
                          "30-day sell-through percentage",
                          settings.average + 1,
                          100,
                        ],
                        [
                          "average",
                          "Average sell-through threshold",
                          "30-day sell-through percentage",
                          0,
                          settings.hit - 1,
                        ],
                        [
                          "fast",
                          "Fast seller threshold",
                          "Units per in-stock day · SKU / size",
                          0.1,
                          10,
                        ],
                        [
                          "slow",
                          "Slow seller threshold",
                          "Units per in-stock day · SKU / size",
                          0.01,
                          1,
                        ],
                        [
                          "freshDays",
                          "Freshness window",
                          "New season styles launched within these days",
                          1,
                          365,
                        ],
                      ] as const
                    ).map(([key, label, help, min, max]) => (
                      <SettingInput
                        key={key}
                        label={label}
                        help={help}
                        value={settings[key]}
                        step={key === "fast" || key === "slow" ? 0.05 : 1}
                        min={min}
                        max={max}
                        onChange={(v) =>
                          setSettings((s) => ({ ...s, [key]: v }))
                        }
                      />
                    ))}
                  </div>
                </Panel>
              </div>
              <div className="settings-bottom">
                <p>
                  <Info size={16} />
                  Season forecasts are precomputed and do not change with these
                  settings.
                </p>
                <Button
                  onClick={() => {
                    setSettings({ ...defaults });
                    setToast("Demo settings restored.");
                  }}
                >
                  <RotateCcw size={15} />
                  Reset demo settings
                </Button>
              </div>
              <Panel
                title="A prototype with a clear foundation"
                subtitle="30 referenced products · 150 variants · 6 locations · 24 months of synthetic history"
              >
                <p className="panel-paragraph">
                  The asynchronous fixture provider can later be replaced by
                  FastAPI. This milestone runs locally without backend
                  credentials. Pricing, costs, stock, sales, store names and
                  matching relationships are simulated. Public product names,
                  imagery and catalogue attributes remain source referenced.
                </p>
              </Panel>
            </>
          )}
          <footer className="page-footer">
            <span>THE LOOM · INVENTORY STUDIO</span>
            <span>
              Thoughtful stock. Informed decisions.{" "}
              <span className="footer-demo">Demo prototype</span>
            </span>
          </footer>
        </main>
      </div>
      <Dialog open={mobile} onOpenChange={setMobile}>
        <DialogContent className="mobile-nav" onCloseAutoFocus={restore}>
          <DialogTitle className="sr-only">Navigation</DialogTitle>
          <DialogDescription className="sr-only">
            Choose a dashboard section.
          </DialogDescription>
          <Nav inDialog />
        </DialogContent>
      </Dialog>
      <Dialog open={!!product} onOpenChange={(o) => !o && setProduct(null)}>
        <DialogContent onCloseAutoFocus={restore}>
          {product && (
            <ProductDrawer
              product={product}
              data={data}
              settings={settings}
              filters={filters}
            />
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent
          className="recommendation-dialog"
          onCloseAutoFocus={restore}
        >
          {detail && (
            <>
              <div className="eyebrow">DEMO RECOMMENDATION</div>
              <DialogTitle>
                {detail.kind === "Rotate"
                  ? "A better home for this size."
                  : "Complete a selling size set."}
              </DialogTitle>
              <DialogDescription>
                Proposed stock allocation for review. No inventory action is
                performed.
              </DialogDescription>
              <div className="recommendation-product">
                <ProductImage
                  product={data.products.find(
                    (p) => p.id === detail.productId,
                  )!}
                />
                <strong>
                  {data.products.find((p) => p.id === detail.productId)!.name}
                </strong>
              </div>
              <div className="route-box">
                <span>{location(detail.source)}</span>
                <ArrowRight size={20} />
                <span>{location(detail.destination)}</span>
              </div>
              <div className="detail-stats">
                <div>
                  <strong>{detail.quantity}</strong>
                  <span>Suggested units</span>
                </div>
                <div>
                  <strong>{detail.size}</strong>
                  <span>Size</span>
                </div>
                <div>
                  <strong>{detail.leadDays} days</strong>
                  <span>Assumed lead time</span>
                </div>
              </div>
              <h3>The rationale</h3>
              <p>{detail.reason}</p>
              <div className="demo-note">
                <Info size={14} />
                This suggestion uses synthetic demand and protected donor cover.
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={16} />
          {toast}
        </div>
      )}
    </div>
  );
}
function Metric({
  title,
  value,
  note,
  icon: Icon,
  tone = "",
  onClick,
}: {
  title: string;
  value: string;
  note: string;
  icon: any;
  tone?: string;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag className={"metric " + tone} onClick={onClick}>
      <span className="metric-title">
        {title}
        <Icon size={17} />
      </span>
      <strong>{value}</strong>
      <span className="metric-note">
        {note}
        {onClick && <ArrowUpRight size={13} />}
      </span>
    </Tag>
  );
}
function TrendList({
  items,
  type,
  renderProduct,
}: {
  items: any[];
  type: "up" | "down";
  renderProduct: (p: Product) => React.ReactNode;
}) {
  return (
    <div className="trend-list">
      {items.slice(0, 4).map((t) => (
        <div key={t.product.id}>
          {renderProduct(t.product)}
          <span
            className={
              "trend-change " + (type === "up" ? "green-text" : "red-text")
            }
          >
            {type === "up" ? "+" : ""}
            {number(t[type].change)}%
            <small>
              {t[type].previous} → {t[type].current} units
            </small>
          </span>
        </div>
      ))}
      {!items.length && (
        <div className="empty-state">
          No styles meet this threshold in the selected scope.
        </div>
      )}
    </div>
  );
}
function SettingInput({
  label,
  help,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  help: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="setting-row">
      <label>
        <span>{label}</span>
        <small>{help}</small>
      </label>
      <input
        type="number"
        aria-label={label}
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onChange(Math.max(min, Math.min(max, v)));
        }}
      />
    </div>
  );
}
function ProductDrawer({
  product: p,
  data: d,
  settings: s,
  filters: f,
}: {
  product: Product;
  data: Dataset;
  settings: Settings;
  filters: Filters;
}) {
  const rr = filterInventory(d, {
    location: f.location,
    channel: f.channel,
  }).filter((r) => r.productId === p.id);
  const sales = filterSales(d, {
    location: f.location,
    channel: f.channel,
    from: dayBefore(d.asOf, 28),
    to: dayBefore(d.asOf, 1),
  }).filter((x) => x.productId === p.id);
  const movements = d.movements
    .filter(
      (m) =>
        m.variantId.startsWith(p.id + "-") &&
        (!f.location || m.locationId === f.location) &&
        (!f.channel ||
          (f.channel === "Ecommerce"
            ? m.locationId === "HO"
            : m.locationId !== "HO")),
    )
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const plans = recommend(d, s).filter(
    (x) =>
      x.productId === p.id && (!f.location || x.destination === f.location),
  );
  return (
    <>
      <div className="eyebrow">PRODUCT DETAIL / {p.sku}</div>
      <DialogTitle>{p.name}</DialogTitle>
      <DialogDescription>
        Source catalogue imagery. Business values and applicable sizes are
        simulated.
      </DialogDescription>
      <ProductImage product={p} large />
      <a
        href={p.sourceProductUrl}
        target="_blank"
        rel="noreferrer"
        className="source-link"
      >
        View source product <ArrowUpRight size={13} />
      </a>
      <dl className="attributes">
        <div>
          <dt>Fabric · {p.provenance.fabric}</dt>
          <dd>{p.fabric}</dd>
        </div>
        <div>
          <dt>Craft · {p.provenance.craft}</dt>
          <dd>{p.craft}</dd>
        </div>
        <div>
          <dt>Colour · {p.provenance.color}</dt>
          <dd>{p.color}</dd>
        </div>
        <div>
          <dt>Style · simulated</dt>
          <dd>{p.style}</dd>
        </div>
        <div>
          <dt>Cost · simulated</dt>
          <dd>{money(p.cost)}</dd>
        </div>
        <div>
          <dt>Suggested MRP · simulated</dt>
          <dd>{money(p.suggestedMrp)}</dd>
        </div>
        <div>
          <dt>Kurta length · simulated</dt>
          <dd>
            {p.category === "Dupattas"
              ? "Not applicable"
              : p.kurtaLength + " inches"}
          </dd>
        </div>
        <div>
          <dt>Season · simulated</dt>
          <dd>{p.season}</dd>
        </div>
      </dl>
      <h3>Size availability</h3>
      <div className="drawer-size-grid">
        {p.sizes.map((size) => (
          <div key={size}>
            <span>{size}</span>
            <strong>
              {sum(
                rr.filter((r) => r.size === size),
                (r) => r.available,
              )}
            </strong>
            <small>
              {sum(
                rr.filter((r) => r.size === size),
                (r) => r.inTransit,
              )}{" "}
              transit
            </small>
          </div>
        ))}
      </div>
      <ReportChart
        data={series(sales)}
        x="date"
        kind="area"
        label="28-day product sales"
      />
      <h3>Recommendation rationale</h3>
      {plans.length ? (
        plans.slice(0, 3).map((r) => (
          <p className="rationale" key={r.id}>
            <strong>
              {r.size} · {r.quantity} units →{" "}
              {d.locations.find((l) => l.id === r.destination)!.city}
            </strong>
            {r.reason}
          </p>
        ))
      ) : (
        <p className="muted">
          No feasible replenishment in this location scope.
        </p>
      )}
      <h3>Recent stock movements</h3>
      <div className="table-scroll">
        <table>
          <caption className="sr-only">Recent product movements</caption>
          <thead>
            <tr>
              <th>Date</th>
              <th>Size / location</th>
              <th>Reason</th>
              <th>Units</th>
            </tr>
          </thead>
          <tbody>
            {movements.slice(0, 10).map((m) => (
              <tr key={m.id}>
                <td>{m.date}</td>
                <td>
                  {m.variantId.split("-").slice(1).join("-")} · {m.locationId}
                </td>
                <td>{m.reason}</td>
                <td>
                  {m.quantity > 0 ? "+" : ""}
                  {m.quantity}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
