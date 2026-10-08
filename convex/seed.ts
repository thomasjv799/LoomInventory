import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { checkChunk, fail } from "./domain/validation";
import { insertSeedRow, tableMap } from "./domain/seed";
export const begin = internalMutation({
  args: { sourceHash: v.string(), asOf: v.string() },
  handler: async (ctx, args) => {
    if (
      !["development", "preview"].includes(process.env.DEPLOYMENT_ENV ?? "") &&
      process.env.ALLOW_SYNTHETIC_SEED !== "true"
    )
      fail("FORBIDDEN", "Production seed disabled");
    const organizationId = await ctx.db.insert("organizations", {
      name: "The Loom demo",
      currency: "INR",
      timezone: "Asia/Kolkata",
      sourceWatermark: 0,
      synthetic: true,
    });
    const datasetVersionId = await ctx.db.insert("datasetVersions", {
      organizationId,
      sourceHash: args.sourceHash,
      asOf: args.asOf,
      status: "staged",
      baseWatermark: 0,
    });
    return { organizationId, datasetVersionId };
  },
});
export const stageChunk = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    datasetVersionId: v.id("datasetVersions"),
    table: v.string(),
    chunkKey: v.string(),
    rows: v.string(),
  },
  handler: async (ctx, args) => {
    const rows = JSON.parse(args.rows);
    checkChunk(rows);
    if (!(args.table in tableMap)) fail("INVALID_INPUT", "Unsupported table");
    const key = `${args.datasetVersionId}:${args.table}:${args.chunkKey}`;
    const previous = await ctx.db
      .query("idempotency")
      .withIndex("by_key", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("operation", "seed")
          .eq("key", key),
      )
      .unique();
    if (previous) {
      if (previous.hash !== args.rows) fail("CONFLICT", "Changed seed chunk");
      return JSON.parse(previous.result);
    }
    const ids = [];
    for (const row of rows)
      ids.push(
        await insertSeedRow(
          ctx,
          args.organizationId,
          args.datasetVersionId,
          args.table as keyof typeof tableMap,
          row,
        ),
      );
    await ctx.db.insert("idempotency", {
      organizationId: args.organizationId,
      operation: "seed",
      key,
      hash: args.rows,
      result: JSON.stringify(ids),
    });
    return ids;
  },
});
