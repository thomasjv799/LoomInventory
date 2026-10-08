"use client";
import { useEffect, useMemo, useState, useRef } from "react";
import { useConvex, useQuery } from "convex/react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Boxes,
  Store,
  ChartNoAxesCombined,
  PackagePlus,
  CalendarDays,
  Layers,
  Settings2,
  Download,
  Menu,
  Plus,
  RefreshCw,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { Filters, Settings } from "@/lib/types";
import type { ReportName, ReportRow, ReportEnvelope } from "@/lib/report-types";
import { ConvexInventoryProvider } from "@/lib/providers/convex";
import { LogoutButton } from "./logout-button";
import { defaults, exportCsv, money } from "@/lib/analytics";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { ReportChart } from "./charts";
import { ProductImage } from "./product-image";
import { ProductCreateDrawer } from "./product-create-drawer";
const sections = [
  {
    id: "overview",
    name: "Overview",
    icon: LayoutDashboard,
    reports: ["overview", "ho-shortages", "slow-stock"],
  },
  { id: "inventory", name: "Inventory", icon: Boxes, reports: ["inventory"] },
  {
    id: "stores",
    name: "Stores & Rotation",
    icon: Store,
    reports: ["stores", "rotation"],
  },
  {
    id: "sales",
    name: "Sales & Attributes",
    icon: ChartNoAxesCombined,
    reports: ["sales"],
  },
  {
    id: "replenishment",
    name: "Replenishment & Forecasts",
    icon: PackagePlus,
    reports: ["replenishment", "size-packs", "forecasts"],
  },
  {
    id: "events",
    name: "Events & Influencers",
    icon: CalendarDays,
    reports: ["events"],
  },
  {
    id: "dupatta",
    name: "Dupatta Analysis",
    icon: Layers,
    reports: ["dupatta"],
  },
  { id: "settings", name: "Settings", icon: Settings2, reports: [] },
];
const reportLabels: Record<string, string> = {
  overview: "Priority actions",
  "ho-shortages": "Central warehouse shortages",
  "slow-stock": "Slow / dead stock",
  stores: "Store size availability",
  rotation: "Store transfer suggestions",
  replenishment: "Suggested stock replenishment",
  "size-packs": "Size mix & replenishment time",
  forecasts: "Three-month projections",
};
export default function ConvexDashboard() {
  const params = useSearchParams(),
    router = useRouter(),
    client = useConvex(),
    me = useQuery(api.memberships.me, {});
  const [orgId, setOrgId] = useState<Id<"organizations"> | null>(null),
    [mobile, setMobile] = useState(false),
    [create, setCreate] = useState(false),
    [calendarYear, setCalendarYear] = useState("2026"),
    [productId, setProductId] = useState<Id<"products"> | null>(null),
    [runId, setRunId] = useState<Id<"reportRuns"> | null>(null),
    [cursor, setCursor] = useState<string | undefined>(),
    [previous, setPrevious] = useState<(string | undefined)[]>([]),
    [error, setError] = useState<string | null>(null),
    [revision, setRevision] = useState(0);
  const [runContext, setRunContext] = useState<string | null>(null);
  const [timelineError, setTimelineError] = useState<string | null>(null);
  const [productTimeline, setProductTimeline] = useState<ReportEnvelope | null>(
    null,
  );
  const lastFocus = useRef<HTMLElement | null>(null);
  const rememberFocus = () => {
    lastFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
  };
  const restoreFocus = (event: Event) => {
    event.preventDefault();
    lastFocus.current?.focus();
  };
  const membership =
    me?.memberships.find((m) => m.organizationId === orgId) ??
    me?.memberships[0];
  const organizationId = membership?.organizationId;
  const section =
    sections.find((s) => s.id === params.get("view")) ?? sections[0];
  const reportName = (
    section.reports.includes(params.get("report") ?? "")
      ? params.get("report")
      : section.reports[0]
  ) as ReportName | undefined;
  const filterKeys = [
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
  ] as const;
  const filterString = JSON.stringify(
    Object.fromEntries(
      filterKeys.map((k) => [k, params.get(k)]).filter(([, v]) => v),
    ),
  );
  const filters = JSON.parse(filterString) as Filters;
  const provider = useMemo(
    () =>
      organizationId
        ? new ConvexInventoryProvider(client, organizationId)
        : null,
    [client, organizationId],
  );
  const locations = useQuery(
    api.memberships.locations,
    organizationId ? { organizationId } : "skip",
  );
  const catalogue = useQuery(
    api.catalogue.list,
    organizationId ? { organizationId, limit: 100 } : "skip",
  );
  const settings = useQuery(
    api.settings.get,
    organizationId ? { organizationId } : "skip",
  );
  const product = useQuery(
    api.catalogue.detail,
    organizationId && productId ? { organizationId, productId } : "skip",
  );
  const context = JSON.stringify({
    organizationId,
    reportName,
    filterString,
    revision,
    sort: params.get("sort"),
    direction: params.get("direction"),
    layout: params.get("layout"),
  });
  const page = useQuery(
    api.reports.page,
    organizationId && runId && runContext === context
      ? { organizationId, runId, cursor, limit: 25 }
      : "skip",
  );
  useEffect(() => {
    let active = true;
    setProductTimeline(null);
    setTimelineError(null);
    if (provider && product)
      provider
        .getReport("events", {
          q: product.product.sku,
          ...(filters.location ? { location: filters.location } : {}),
        })
        .then((value) => {
          if (active) setProductTimeline(value);
        })
        .catch(() => {
          if (active)
            setTimelineError(
              "Sales timeline unavailable. Reopen the product to retry.",
            );
        });
    return () => {
      active = false;
    };
  }, [provider, productId, product?.product.sku, filters.location]);
  const networkAllowed = membership?.networkRead;
  const restricted =
    ["rotation", "replenishment", "ho-shortages", "forecasts"].includes(
      reportName ?? "",
    ) && !networkAllowed;
  function update(values: Record<string, string | undefined>) {
    const p = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(values)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    router.replace("/?" + p.toString());
  }
  function navigate(view: string) {
    setMobile(false);
    update({
      view,
      report: undefined,
      location: undefined,
      channel: undefined,
      from: undefined,
      to: undefined,
      status: undefined,
      sort: undefined,
      direction: undefined,
    });
  }
  useEffect(() => {
    let active = true;
    setRunId(null);
    setCursor(undefined);
    setPrevious([]);
    setError(null);
    const timer = setTimeout(() => {
      if (provider && reportName && !restricted)
        provider
          .requestReport(
            reportName,
            filters,
            params.get("sort") ?? undefined,
            params.get("direction") === "desc" ? "desc" : "asc",
            params.get("layout") === "matrix" ? "matrix" : "table",
          )
          .then((r) => {
            if (active) {
              setRunContext(context);
              setRunId(r.runId);
            }
          })
          .catch((e) => {
            if (active)
              setError(e instanceof Error ? e.message : "Report unavailable");
          });
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [
    provider,
    reportName,
    filterString,
    revision,
    restricted,
    params.get("sort"),
    params.get("direction"),
    params.get("layout"),
  ]);
  const report = page?.report;
  const nav = (
    <div className="sidebar-inner">
      <a className="login-brand" href="/" style={{ marginBottom: 36 }}>
        <span className="login-mark">L</span>
        <span>
          THE LOOM<small>INVENTORY STUDIO</small>
        </span>
      </a>
      <nav aria-label="Main navigation">
        {sections.map((s) => (
          <button
            className={"nav-item " + (section.id === s.id ? "active" : "")}
            key={s.id}
            onClick={() => navigate(s.id)}
            aria-current={section.id === s.id ? "page" : undefined}
          >
            <s.icon size={18} />
            {s.name}
          </button>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <span>{membership?.organization?.name}</span>
        <small>{membership?.role}</small>
      </div>
    </div>
  );
  const styles = catalogue?.data ?? [];
  const productsByExternal = new Map(styles.map((p) => [p.externalId, p]));
  const availableLocations = (locations ?? []).filter(
    (l) => section.id !== "stores" || l.type === "store",
  );
  async function exportCurrent() {
    if (!provider || !runId) return;
    try {
      setError(null);
      exportCsv(await provider.exportReport(runId), reportName ?? "report");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    }
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">{nav}</aside>
      <div className="app-main">
        <header className="topbar">
          <div className="breadcrumb">
            <Button
              className="mobile-menu"
              size="icon"
              aria-label="Open navigation"
              onClick={() => {
                rememberFocus();
                setMobile(true);
              }}
            >
              <Menu size={18} />
            </Button>
            <span>Workspace</span>
            <span>/</span>
            <strong>{section.name}</strong>
          </div>
          <div className="header-right">
            {me && me.memberships.length > 1 && (
              <select
                aria-label="Organization"
                value={organizationId}
                onChange={(e) => {
                  setOrgId(e.target.value as Id<"organizations">);
                  setProductId(null);
                }}
              >
                {me.memberships.map((m) => (
                  <option key={m.organizationId} value={m.organizationId}>
                    {m.organization?.name}
                  </option>
                ))}
              </select>
            )}
            <span>
              {membership?.organization?.synthetic
                ? "Synthetic demo"
                : "Inventory workspace"}
            </span>
            <LogoutButton />
          </div>
        </header>
        <main id="main-content">
          <div className="page-heading">
            <h1>{section.name}</h1>
            <div className="panel-actions">
              {section.id === "inventory" && (
                <>
                  <Button
                    variant="ghost"
                    onClick={() => update({ layout: "table", sort: undefined })}
                  >
                    Table
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      update({ layout: "matrix", sort: undefined })
                    }
                  >
                    Size matrix
                  </Button>
                </>
              )}
              {["administrator", "merchandiser"].includes(
                membership?.role ?? "",
              ) && (
                <Button
                  onClick={() => {
                    rememberFocus();
                    setCreate(true);
                  }}
                >
                  <Plus size={15} />
                  Add product
                </Button>
              )}
              {section.id !== "settings" && (
                <Button onClick={exportCurrent} disabled={!report}>
                  <Download size={15} />
                  Export report
                </Button>
              )}
            </div>
          </div>
          {membership?.organization?.synthetic && (
            <div className="demo-note">
              All business data is simulated. Product references come from The
              Loom’s public catalogue.
            </div>
          )}
          {section.reports.length > 1 && (
            <div
              className="report-tabs"
              role="group"
              aria-label="Choose report"
            >
              {section.reports.map((name) => (
                <Button
                  variant={reportName === name ? "default" : "ghost"}
                  key={name}
                  onClick={() => update({ report: name, location: undefined })}
                >
                  {reportLabels[name]}
                </Button>
              ))}
            </div>
          )}
          {section.id !== "settings" && (
            <div className="filters backend-filters">
              {!["forecasts", "ho-shortages"].includes(reportName ?? "") && (
                <label>
                  {section.id === "events" ? "Timeline location" : "Location"}
                  <select
                    value={filters.location ?? ""}
                    onChange={(e) =>
                      update({ location: e.target.value || undefined })
                    }
                  >
                    <option value="">
                      All permitted{" "}
                      {section.id === "stores" ? "stores" : "locations"}
                    </option>
                    {availableLocations.map((l) => (
                      <option key={l._id} value={l.externalId}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                Search style / SKU
                <input
                  value={filters.q ?? ""}
                  onChange={(e) => update({ q: e.target.value || undefined })}
                  placeholder="Product name or SKU"
                />
              </label>
              {[
                "overview",
                "inventory",
                "sales",
                "replenishment",
                "dupatta",
              ].includes(section.id) && (
                <>
                  {(
                    ["category", "fabric", "color", "craft", "size"] as const
                  ).map((key) => (
                    <label key={key}>
                      {
                        {
                          category: "Category",
                          fabric: "Fabric",
                          color: "Colour",
                          craft: "Craft",
                          size: "Size",
                        }[key]
                      }
                      <select
                        value={filters[key] ?? ""}
                        onChange={(e) =>
                          update({ [key]: e.target.value || undefined })
                        }
                      >
                        <option value="">All</option>
                        {[
                          ...new Set(
                            report?.facets?.[key]?.map((f) => f.value) ??
                              (key === "size"
                                ? [
                                    "XS",
                                    "S",
                                    "M",
                                    "L",
                                    "XL",
                                    "XXL",
                                    "3XL",
                                    "Free size",
                                  ]
                                : styles.map((p) => p[key])),
                          ),
                        ]
                          .sort()
                          .map((v) => (
                            <option
                              key={v}
                              disabled={
                                !!report?.facets &&
                                !report.facets[key]?.find((x) => x.value === v)
                                  ?.count &&
                                filters[key] !== v
                              }
                            >
                              {v}
                            </option>
                          ))}
                      </select>
                    </label>
                  ))}
                </>
              )}
              {["sales", "events"].includes(section.id) && (
                <>
                  <label>
                    {section.id === "events" ? "Timeline channel" : "Channel"}
                    <select
                      value={filters.channel ?? ""}
                      onChange={(e) =>
                        update({ channel: e.target.value || undefined })
                      }
                    >
                      <option value="">All channels</option>
                      <option>Ecommerce</option>
                      <option>Store</option>
                    </select>
                  </label>
                  <label>
                    From
                    <input
                      type="date"
                      value={filters.from ?? ""}
                      onChange={(e) =>
                        update({ from: e.target.value || undefined })
                      }
                    />
                  </label>
                  <label>
                    To
                    <input
                      type="date"
                      value={filters.to ?? ""}
                      onChange={(e) =>
                        update({ to: e.target.value || undefined })
                      }
                    />
                  </label>
                </>
              )}
              <Button
                variant="ghost"
                onClick={() => {
                  const p = new URLSearchParams();
                  p.set("view", section.id);
                  if (reportName) p.set("report", reportName);
                  router.replace("/?" + p);
                }}
              >
                Clear filters
              </Button>
            </div>
          )}
          {error && (
            <p role="alert" className="login-notice error">
              {error}
            </p>
          )}
          {section.id === "settings" ? (
            settings && provider ? (
              <BackendSettings
                values={settings.values}
                version={settings.version}
                provider={provider}
                editable={membership?.role === "administrator"}
              />
            ) : (
              <div role="status">Loading settings…</div>
            )
          ) : restricted ? (
            <section className="panel empty-state">
              This report requires network inventory access. Your
              assigned-location reports remain available.
            </section>
          ) : !report ? (
            <section className="panel empty-state" role="status">
              {page?.status === "failed"
                ? "Report preparation failed. Check the imported data."
                : page?.status === "stale"
                  ? "The data or settings changed. Refresh this report."
                  : "Preparing your report…"}
              {["failed", "stale"].includes(page?.status ?? "") && (
                <Button onClick={() => setRevision((r) => r + 1)}>
                  <RefreshCw size={14} />
                  Refresh
                </Button>
              )}
            </section>
          ) : (
            <>
              {report.meta.ignoredFilters.length > 0 && (
                <p role="status">
                  Not applied on this report:{" "}
                  {report.meta.ignoredFilters.join(", ")}.
                </p>
              )}
              <div className="backend-metrics">
                {Object.entries(report.totals).map(([key, value]) => (
                  <button
                    className="panel backend-metric"
                    key={key}
                    onClick={() => {
                      if (
                        key === "available" ||
                        key === "inTransit" ||
                        key === "sellingStockouts"
                      )
                        update({
                          view: "inventory",
                          report: undefined,
                          status:
                            key === "sellingStockouts"
                              ? "Selling stockout"
                              : undefined,
                        });
                    }}
                  >
                    <span>
                      {key.replace(/([A-Z])/g, " $1").replace("Minor", "")}
                    </span>
                    <strong>
                      {value === null
                        ? "Unavailable"
                        : key.endsWith("Minor")
                          ? money(value)
                          : new Intl.NumberFormat("en-IN", {
                              maximumFractionDigits: 1,
                            }).format(value)}
                    </strong>
                  </button>
                ))}
              </div>
              <section className="panel">
                <div className="panel-heading">
                  <h2>{reportLabels[reportName ?? ""] ?? section.name}</h2>
                  <span>As of {report.meta.asOf}</span>
                </div>
                <div
                  className="table-scroll"
                  role="region"
                  aria-label={`${section.name} report table`}
                  tabIndex={0}
                >
                  <table>
                    <caption className="sr-only">
                      {section.name} · current page from one report snapshot
                    </caption>
                    <thead>
                      <tr>
                        {report.columns.map((c) => (
                          <th
                            key={c.key}
                            aria-sort={
                              params.get("sort") === c.key
                                ? params.get("direction") === "desc"
                                  ? "descending"
                                  : "ascending"
                                : "none"
                            }
                          >
                            <button
                              className="sort-button"
                              onClick={() =>
                                update({
                                  sort: c.key,
                                  direction:
                                    params.get("sort") === c.key &&
                                    params.get("direction") !== "desc"
                                      ? "desc"
                                      : "asc",
                                })
                              }
                            >
                              {c.label} ↕
                            </button>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {report.data.map((row, index) => (
                        <tr key={String(row.id ?? index)}>
                          {report.columns.map((c) => (
                            <td key={c.key}>
                              {c.key === "name" && row.productId ? (
                                <button
                                  className="product-link"
                                  onClick={async () => {
                                    rememberFocus();
                                    const p = productsByExternal.get(
                                      String(row.productId),
                                    );
                                    if (p) {
                                      rememberFocus();
                                      setProductId(p._id);
                                    } else if (provider) {
                                      try {
                                        const resolved =
                                          await provider.resolveProduct(
                                            String(row.productId),
                                          );
                                        setProductId(resolved.productId);
                                      } catch {
                                        setError(
                                          "Product details are unavailable. Refresh the report.",
                                        );
                                      }
                                    }
                                  }}
                                >
                                  <ProductImage
                                    product={{
                                      image: String(
                                        row.image ??
                                          productsByExternal.get(
                                            String(row.productId),
                                          )?.image ??
                                          "",
                                      ),
                                      name: String(row.name),
                                      color: String(
                                        productsByExternal.get(
                                          String(row.productId),
                                        )?.color ?? "",
                                      ),
                                    }}
                                  />
                                  {String(row[c.key] ?? "Unavailable")}
                                </button>
                              ) : row[c.key] === null ? (
                                "Insufficient data"
                              ) : c.key.endsWith("Minor") &&
                                typeof row[c.key] === "number" ? (
                                money(row[c.key] as number)
                              ) : (
                                String(row[c.key] ?? "—")
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!report.data.length && (
                    <div className="empty-state">
                      No results match this selection. Clear filters to see the
                      complete report.
                    </div>
                  )}
                </div>
                <div className="table-footer">
                  <span>
                    {report.data.length} rows · page {previous.length + 1}
                  </span>
                  <div>
                    <Button
                      size="sm"
                      disabled={!previous.length}
                      onClick={() => {
                        setCursor(previous[previous.length - 1]);
                        setPrevious(previous.slice(0, -1));
                      }}
                    >
                      Previous
                    </Button>
                    <Button
                      size="sm"
                      disabled={!report.meta.nextCursor}
                      onClick={() => {
                        setPrevious([...previous, cursor]);
                        setCursor(report.meta.nextCursor ?? undefined);
                      }}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </section>
              {report.charts.length > 0 && (
                <div className="backend-charts">
                  {report.charts.map((chart) => (
                    <section className="panel" key={chart.label}>
                      <ReportChart {...chart} events={report.calendar ?? []} />
                    </section>
                  ))}
                </div>
              )}
              {report.calendar && (
                <section className="panel">
                  <div className="panel-heading">
                    <h2>Festival & event calendar</h2>
                    <label>
                      Year{" "}
                      <select
                        value={calendarYear}
                        onChange={(e) => setCalendarYear(e.target.value)}
                      >
                        {[
                          ...new Set(
                            report.calendar.map((e) => e.start.slice(0, 4)),
                          ),
                        ]
                          .sort()
                          .map((year) => (
                            <option key={year}>{year}</option>
                          ))}
                      </select>
                    </label>
                  </div>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Event</th>
                          <th>Starts</th>
                          <th>Ends</th>
                          <th>Evidence</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.calendar
                          .filter((e) => e.start.startsWith(calendarYear))
                          .map((e) => (
                            <tr key={e.id}>
                              <td>{e.name}</td>
                              <td>{e.start}</td>
                              <td>{e.end}</td>
                              <td>{e.kind}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
              <details className="panel report-assumptions">
                <summary>Definitions & assumptions</summary>
                {report.notes.map((note, i) => (
                  <p key={i}>{note}</p>
                ))}
              </details>
            </>
          )}
        </main>
      </div>
      <Dialog open={mobile} onOpenChange={setMobile}>
        <DialogContent onCloseAutoFocus={restoreFocus}>
          <DialogTitle>Navigation</DialogTitle>
          <DialogDescription>Choose an inventory section.</DialogDescription>
          {nav}
        </DialogContent>
      </Dialog>
      {provider && (
        <ProductCreateDrawer
          open={create}
          onOpenChange={setCreate}
          provider={provider}
          onCloseAutoFocus={restoreFocus}
          onCreated={() => setRevision((r) => r + 1)}
        />
      )}
      <Dialog
        open={!!productId}
        onOpenChange={(open) => {
          if (!open) setProductId(null);
        }}
      >
        <DialogContent
          className="product-drawer"
          onCloseAutoFocus={restoreFocus}
        >
          <DialogTitle>
            {product?.product.name ?? "Product details"}
          </DialogTitle>
          <DialogDescription>
            Attributes and stock at your permitted locations.
          </DialogDescription>
          {product && (
            <>
              <ProductImage
                large
                product={{
                  image: product.images[0]?.url ?? "",
                  name: product.product.name,
                  color: product.product.color,
                }}
              />
              <p>
                {product.product.sku} · {product.product.fabric} ·{" "}
                {product.product.craft} · {product.product.color}
              </p>
              <p>
                Suggested MRP {money(product.product.suggestedMrpMinor)}
                {product.product.costMinor !== null
                  ? ` · Cost ${money(product.product.costMinor)}`
                  : ""}
              </p>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Size</th>
                      <th>Location</th>
                      <th>Condition</th>
                      <th>Quantity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {product.balances.map((b) => (
                      <tr key={b._id}>
                        <td>
                          {
                            product.variants.find((v) => v._id === b.variantId)
                              ?.size
                          }
                        </td>
                        <td>
                          {locations?.find((l) => l._id === b.locationId)?.name}
                        </td>
                        <td>{b.condition}</td>
                        <td>{b.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>
                Bin quantities include quarantined or excluded stock. Use
                Inventory for available units.
              </p>
              <h2>
                Recent movements ·{" "}
                {
                  locations?.find((l) => l._id === product.historyLocationId)
                    ?.name
                }
              </h2>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Size</th>
                      <th>Reason</th>
                      <th>Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {product.movements.map((m) => (
                      <tr key={m._id}>
                        <td>{m.effectiveAt}</td>
                        <td>
                          {
                            product.variants.find((v) => v._id === m.variantId)
                              ?.size
                          }
                        </td>
                        <td>{m.reason}</td>
                        <td>{m.quantityDelta}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>
                Latest five records per size, up to 25 shown. The movement API
                provides the complete paginated history.
              </p>
              {productTimeline ? (
                productTimeline.charts.map((chart) => (
                  <ReportChart
                    key={chart.label}
                    {...chart}
                    events={productTimeline.calendar ?? []}
                  />
                ))
              ) : (
                <p role="status">
                  {timelineError ?? "Preparing the sales timeline…"}
                </p>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
function BackendSettings({
  values,
  version,
  provider,
  editable,
}: {
  values: Settings;
  version: number;
  provider: ConvexInventoryProvider;
  editable: boolean;
}) {
  const [draft, setDraft] = useState(values),
    [message, setMessage] = useState<string | null>(null),
    [pending, setPending] = useState(false);
  useEffect(() => setDraft(values), [values]);
  async function save(next: Settings) {
    setPending(true);
    setMessage(null);
    try {
      await provider.updateSettings(next, version, crypto.randomUUID());
      setMessage(
        "Settings saved. Refresh reports to use the new thresholds. Forecasts remain precomputed.",
      );
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Settings could not be saved.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="panel">
      <h2>Inventory settings</h2>
      <p>Classifications and target stock days apply to new report runs.</p>
      <div className="catalogue-form form-grid">
        {(
          [
            "cover",
            "peakCover",
            "minimum",
            "deadDays",
            "spike",
            "drop",
            "fast",
            "slow",
            "hit",
            "average",
            "freshDays",
          ] as const
        ).map((key) => (
          <label key={key}>
            {
              {
                cover: "Target stock days",
                peakCover: "Peak target stock days",
                minimum: "Minimum units per required size",
                deadDays: "Dead-stock days",
                spike: "Sales increase threshold %",
                drop: "Sales drop threshold %",
                fast: "Fast-seller units / day",
                slow: "Slow-seller units / day",
                hit: "Hit sell-through %",
                average: "Average sell-through %",
                freshDays: "Freshness days",
              }[key]
            }
            <input
              type="number"
              value={draft[key]}
              disabled={!editable}
              step={["fast", "slow"].includes(key) ? ".1" : "1"}
              onChange={(e) =>
                setDraft({ ...draft, [key]: Number(e.target.value) })
              }
            />
          </label>
        ))}
        <label>
          Required sizes
          <input
            value={draft.coreSizes.join(", ")}
            disabled={!editable}
            onChange={(e) =>
              setDraft({
                ...draft,
                coreSizes: e.target.value
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean),
              })
            }
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={draft.peak}
            disabled={!editable}
            onChange={(e) => setDraft({ ...draft, peak: e.target.checked })}
          />
          Use peak target stock days
        </label>
      </div>
      {message && <p role="status">{message}</p>}
      {editable ? (
        <div className="panel-actions">
          <Button disabled={pending} onClick={() => save(draft)}>
            Save settings
          </Button>
          <Button
            variant="ghost"
            disabled={pending}
            onClick={() => save(defaults)}
          >
            Reset thresholds
          </Button>
        </div>
      ) : (
        <p>Only an administrator can change these settings.</p>
      )}
    </section>
  );
}
