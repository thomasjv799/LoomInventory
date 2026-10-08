import type { ConvexReactClient } from "convex/react";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import type { Filters, Settings } from "../types";
import type {
  InventoryProvider,
  ReportName,
  ReportEnvelope,
} from "../report-types";
export class ConvexInventoryProvider implements InventoryProvider {
  constructor(
    private client: ConvexReactClient,
    readonly organizationId: Id<"organizations">,
  ) {}
  getLocations() {
    return this.client.query(api.memberships.locations, {
      organizationId: this.organizationId,
    });
  }
  listProducts(input: { cursor?: string; limit?: number } = {}) {
    return this.client.query(api.catalogue.list, {
      organizationId: this.organizationId,
      ...input,
    });
  }
  getProduct(productId: Id<"products">) {
    return this.client.query(api.catalogue.detail, {
      organizationId: this.organizationId,
      productId,
    });
  }
  getSettings() {
    return this.client.query(api.settings.get, {
      organizationId: this.organizationId,
    });
  }
  updateSettings(
    values: Settings,
    expectedVersion: number,
    idempotencyKey: string,
  ) {
    return this.client.mutation(api.settings.update, {
      organizationId: this.organizationId,
      values,
      expectedVersion,
      idempotencyKey,
    });
  }
  createProduct(
    input: import("../catalogue-input").CatalogueInput,
    idempotencyKey: string,
  ) {
    return this.client.mutation(api.catalogue.create, {
      organizationId: this.organizationId,
      input,
      idempotencyKey,
    });
  }
  async requestReport(
    name: ReportName,
    filters: Filters,
    sort?: string,
    direction?: "asc" | "desc",
    layout?: "table" | "matrix",
  ) {
    return this.client.mutation(api.reports.request, {
      organizationId: this.organizationId,
      name,
      filters: JSON.stringify(filters),
      sort,
      direction,
      layout,
    });
  }
  async getReport(
    name: ReportName,
    filters: Filters,
    page?: { cursor?: string; limit?: number; runId?: string },
  ): Promise<ReportEnvelope> {
    if (page?.cursor && !page.runId)
      throw new Error("Continuation requires the original report runId.");
    const run = page?.runId
      ? { runId: page.runId as Id<"reportRuns"> }
      : await this.requestReport(name, filters);
    const deadline = Date.now() + 60000;
    while (Date.now() < deadline) {
      const value = await this.client.query(api.reports.page, {
        organizationId: this.organizationId,
        runId: run.runId,
        cursor: page?.cursor,
        limit: page?.limit,
      });
      if (value.status === "ready" && value.report) return value.report;
      if (value.status === "failed" || value.status === "stale")
        throw new Error("Report needs refresh.");
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error(
      "Report preparation is taking longer than expected. Please retry.",
    );
  }
  async exportReport(runId: Id<"reportRuns">) {
    let cursor: string | null = null;
    const rows: ReportEnvelope["data"] = [];
    do {
      const result: { status: string; report: ReportEnvelope | null } =
        await this.client.query(api.reports.page, {
          organizationId: this.organizationId,
          runId,
          cursor: cursor ?? undefined,
          limit: 100,
        });
      if (result.status !== "ready" || !result.report)
        throw new Error(
          "Report changed or access was revoked. Refresh before export.",
        );
      rows.push(
        ...result.report.data.map((row) =>
          Object.fromEntries(
            result.report!.columns.map((c) => [
              c.label,
              c.key.endsWith("Minor") && typeof row[c.key] === "number"
                ? Number(row[c.key]) / 100
                : row[c.key],
            ]),
          ),
        ),
      );
      cursor = result.report.meta.nextCursor;
    } while (cursor);
    return rows;
  }
}
