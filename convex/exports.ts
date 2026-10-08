import { query } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { csv } from "../lib/analytics";
import type { ReportEnvelope } from "../lib/report-types";
import { fail } from "./domain/validation";
export const page = query({
  args: {
    organizationId: v.id("organizations"),
    runId: v.id("reportRuns"),
    cursor: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ csv: string; nextCursor: string | null; requestId: string }> => {
    const result: { status: string; report: ReportEnvelope | null } =
      await ctx.runQuery(api.reports.page, { ...args, limit: 100 });
    if (result.status !== "ready" || !result.report)
      fail("CONFLICT", "Refresh the report before exporting");
    const rows = result.report.data.map((r) =>
      Object.fromEntries(
        result.report!.columns.map((c) => [
          c.label,
          c.key.endsWith("Minor") && typeof r[c.key] === "number"
            ? Number(r[c.key]) / 100
            : r[c.key],
        ]),
      ),
    );
    let text = csv(rows);
    if (args.cursor) text = text.replace(/^\ufeff[^\r]*\r\n/, "");
    return {
      csv: text,
      nextCursor: result.report.meta.nextCursor,
      requestId: result.report.meta.requestId,
    };
  },
});
