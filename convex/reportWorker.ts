import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { snapshotTables, toDataset, type Snapshot } from "./domain/snapshot";
import { inventoryMatrix } from "../lib/inventory-matrix";
import { buildReport } from "../lib/report-adapters";
import type { ReportName } from "../lib/report-types";
export const prepare = internalAction({
  args: { runId: v.id("reportRuns") },
  handler: async (ctx, args): Promise<void> => {
    try {
      const { run, version, membership, settings } = await ctx.runQuery(
        internal.reports.preparation,
        args,
      );
      const snapshot = {} as Snapshot;
      let count = 0;
      for (const table of snapshotTables) {
        let cursor: string | null = null;
        const rows = [];
        do {
          const page: {
            page: Snapshot[(typeof snapshotTables)[number]][number][];
            isDone: boolean;
            continueCursor: string;
          } = await ctx.runQuery(internal.reports.sourcePage, {
            runId: args.runId,
            table,
            cursor,
          });
          rows.push(...page.page);
          count += page.page.length;
          if (count > 50000) throw new Error("Report source limit exceeded");
          cursor = page.isDone ? null : page.continueCursor;
        } while (cursor);
        snapshot[table] = rows as never;
      }
      const allowed = new Set(membership.allowedLocationIds);
      snapshot.locations = snapshot.locations.filter((x) => allowed.has(x._id));
      snapshot.bins = snapshot.bins.filter((x) => allowed.has(x.locationId));
      snapshot.stockBalances = snapshot.stockBalances.filter((x) =>
        allowed.has(x.locationId),
      );
      snapshot.inventoryLedger = snapshot.inventoryLedger.filter((x) =>
        allowed.has(x.locationId),
      );
      snapshot.salesOrders = snapshot.salesOrders.filter((x) =>
        allowed.has(x.locationId),
      );
      snapshot.reservations = snapshot.reservations.filter((x) =>
        allowed.has(x.locationId),
      );
      snapshot.transfers = snapshot.transfers.filter(
        (x) => allowed.has(x.sourceId) && allowed.has(x.destinationId),
      );
      const d = toDataset(snapshot, version!.asOf);
      let report = buildReport(
        d,
        run.name as ReportName,
        JSON.parse(run.filters),
        settings,
      );
      const sorting = JSON.parse(run.checkpoint) as {
        sort: string;
        direction: string;
        layout?: string;
      };
      if (run.name === "inventory" && sorting.layout === "matrix")
        report = inventoryMatrix(report);
      report.rows.sort((a, b) => {
        const av = a[sorting.sort],
          bv = b[sorting.sort];
        const comparison =
          av === null
            ? 1
            : bv === null
              ? -1
              : typeof av === "number" && typeof bv === "number"
                ? av - bv
                : String(av ?? "").localeCompare(String(bv ?? ""));
        return (
          (sorting.direction === "desc" ? -comparison : comparison) ||
          String(a.id).localeCompare(String(b.id))
        );
      });
      for (let offset = 0; offset < report.rows.length; offset += 100)
        await ctx.runMutation(internal.reports.putRows, {
          runId: args.runId,
          offset,
          rows: report.rows
            .slice(offset, offset + 100)
            .map((r) => JSON.stringify(r)),
        });
      const { rows, ...totals } = report;
      await ctx.runMutation(internal.reports.publish, {
        runId: args.runId,
        totals: JSON.stringify(totals),
        status: "ready",
      });
    } catch {
      await ctx.runMutation(internal.reports.publish, {
        runId: args.runId,
        totals: JSON.stringify({
          notes: [
            "Report preparation failed or exceeded the prototype history limit. Refresh after reviewing the source data.",
          ],
        }),
        status: "failed",
      });
    }
  },
});
