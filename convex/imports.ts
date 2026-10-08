import {
  query,
  mutation,
  internalQuery,
  internalMutation,
  internalAction,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { requireAccess } from "./access";
import { fail, checkChunk, integer } from "./domain/validation";
import { withIdempotency } from "./domain/idempotency";
import { tableMap, insertSeedRow } from "./domain/seed";
import { snapshotTables, type Snapshot } from "./domain/snapshot";
import {
  inputTypes,
  validateSourceRows,
  reconcileSnapshot,
  validateReferences,
} from "./domain/imports";
export const create = mutation({
  args: {
    organizationId: v.id("organizations"),
    sourceHash: v.string(),
    asOf: v.string(),
    cutoff: v.string(),
    expectedCounts: v.record(v.string(), v.number()),
    inputTypes: v.array(v.string()),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    const scope = await requireAccess(ctx, {
      organizationId: args.organizationId,
      capability: "admin",
    });
    if (
      !args.cutoff ||
      args.cutoff > args.asOf ||
      inputTypes.some((t) => !args.inputTypes.includes(t)) ||
      args.inputTypes.some(
        (t) => !inputTypes.includes(t as (typeof inputTypes)[number]),
      )
    )
      fail(
        "INVALID_INPUT",
        "Provide all eleven input types and an explicit opening cutoff",
      );
    for (const [table, count] of Object.entries(args.expectedCounts)) {
      if (!(table in tableMap)) fail("INVALID_INPUT", "Unknown expected table");
      integer(count, "Expected row count");
    }
    return withIdempotency(
      ctx,
      scope,
      "imports.create",
      args.idempotencyKey,
      args,
      async () => {
        const datasetVersionId = await ctx.db.insert("datasetVersions", {
          organizationId: scope.organizationId,
          sourceHash: args.sourceHash,
          status: "staged",
          asOf: args.asOf,
          baseWatermark: scope.organization.sourceWatermark + 1,
        });
        const batchId = await ctx.db.insert("importBatches", {
          organizationId: scope.organizationId,
          datasetVersionId,
          datasetType: "snapshot",
          sourceHash: args.sourceHash,
          status: "staged",
          cursor: null,
          rows: 0,
          rejected: 0,
          expectedCounts: args.expectedCounts,
          cutoff: args.cutoff,
        });
        return {
          batchId,
          datasetVersionId,
          expectedSourceWatermark: scope.organization.sourceWatermark + 1,
        };
      },
    );
  },
});
export const stageChunk = mutation({
  args: {
    organizationId: v.id("organizations"),
    batchId: v.id("importBatches"),
    table: v.string(),
    chunkKey: v.string(),
    rows: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAccess(ctx, {
      organizationId: args.organizationId,
      capability: "admin",
    });
    const batch = await ctx.db.get(args.batchId);
    if (!batch || batch.organizationId !== args.organizationId)
      fail("NOT_FOUND", "Batch not found");
    if (batch.status !== "staged" || !(args.table in tableMap))
      fail("CONFLICT", "Batch cannot accept this chunk");
    const rows = JSON.parse(args.rows);
    checkChunk(rows);
    validateSourceRows(args.table, rows);
    const chunkKey = args.table + ":" + args.chunkKey;
    const prev = await ctx.db
      .query("importRows")
      .withIndex("by_chunk", (q) =>
        q.eq("batchId", batch._id).eq("chunkKey", chunkKey),
      )
      .unique();
    if (prev) {
      if (prev.hash !== args.rows) fail("CONFLICT", "Chunk changed");
      return prev._id;
    }
    if (batch.rows + rows.length > 50000)
      fail("INVALID_INPUT", "Prototype snapshot limit is 50,000 source rows");
    const id = await ctx.db.insert("importRows", {
      batchId: batch._id,
      chunkKey,
      hash: args.rows,
      rows: args.rows,
      status: "staged",
      errors: [],
    });
    await ctx.db.patch(batch._id, { rows: batch.rows + rows.length });
    return id;
  },
});
export const status = query({
  args: {
    organizationId: v.id("organizations"),
    batchId: v.id("importBatches"),
  },
  handler: async (ctx, args) => {
    await requireAccess(ctx, {
      organizationId: args.organizationId,
      capability: "admin",
    });
    const b = await ctx.db.get(args.batchId);
    if (!b || b.organizationId !== args.organizationId)
      fail("NOT_FOUND", "Batch not found");
    return b;
  },
});
export const rejects = query({
  args: {
    organizationId: v.id("organizations"),
    batchId: v.id("importBatches"),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAccess(ctx, {
      organizationId: args.organizationId,
      capability: "admin",
    });
    const b = await ctx.db.get(args.batchId);
    if (!b || b.organizationId !== args.organizationId)
      fail("NOT_FOUND", "Batch not found");
    const p = await ctx.db
      .query("importRows")
      .withIndex("by_chunk", (q) => q.eq("batchId", b._id))
      .paginate({ numItems: 25, cursor: args.cursor ?? null });
    return {
      ...p,
      page: p.page
        .filter((r) => r.errors.length)
        .map((r) => ({ chunk: r.chunkKey, errors: r.errors })),
    };
  },
});
export const validate = mutation({
  args: {
    organizationId: v.id("organizations"),
    batchId: v.id("importBatches"),
  },
  handler: async (ctx, args) => {
    await requireAccess(ctx, {
      organizationId: args.organizationId,
      capability: "admin",
    });
    const b = await ctx.db.get(args.batchId);
    if (!b || b.organizationId !== args.organizationId)
      fail("NOT_FOUND", "Batch not found");
    if (b.status !== "staged") fail("CONFLICT", "Batch is not staged");
    await ctx.db.patch(b._id, { status: "validating" });
    await ctx.scheduler.runAfter(0, internal.imports.advance, {
      batchId: b._id,
      phase: "validate",
    });
    return { status: "validating" };
  },
});
export const commit = mutation({
  args: {
    organizationId: v.id("organizations"),
    batchId: v.id("importBatches"),
  },
  handler: async (ctx, args) => {
    await requireAccess(ctx, {
      organizationId: args.organizationId,
      capability: "admin",
    });
    const b = await ctx.db.get(args.batchId);
    if (!b || b.organizationId !== args.organizationId)
      fail("NOT_FOUND", "Batch not found");
    if (!["validated", "committing"].includes(b.status))
      fail("CONFLICT", "Validate before commit");
    await ctx.db.patch(b._id, { status: "committing" });
    await ctx.scheduler.runAfter(0, internal.imports.advance, {
      batchId: b._id,
      phase: "commit",
    });
    return { status: "committing" };
  },
});
export const chunkPage = internalQuery({
  args: {
    batchId: v.id("importBatches"),
    cursor: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) =>
    ctx.db
      .query("importRows")
      .withIndex("by_chunk", (q) => q.eq("batchId", args.batchId))
      .paginate({ numItems: 25, cursor: args.cursor }),
});
export const batch = internalQuery({
  args: { batchId: v.id("importBatches") },
  handler: async (ctx, args) => ctx.db.get(args.batchId),
});
export const writeChunk = internalMutation({
  args: { rowId: v.id("importRows") },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.rowId);
    if (!row) fail("NOT_FOUND", "Chunk not found");
    if (row.status === "written") return;
    const b = await ctx.db.get(row.batchId);
    if (!b || b.status !== "committing")
      fail("CONFLICT", "Batch is not committing");
    const table = row.chunkKey.split(":")[0] as keyof typeof tableMap;
    for (const r of JSON.parse(row.rows))
      await insertSeedRow(ctx, b.organizationId, b.datasetVersionId, table, r);
    await ctx.db.patch(row._id, { status: "written" });
  },
});
export const finish = internalMutation({
  args: {
    batchId: v.id("importBatches"),
    status: v.string(),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const b = await ctx.db.get(args.batchId);
    if (!b) fail("NOT_FOUND", "Batch not found");
    await ctx.db.patch(b._id, {
      status: args.status,
      cursor: args.message ?? null,
      rejected: args.status === "failed" ? 1 : 0,
    });
    if (args.status === "failed") {
      await ctx.db.patch(b.datasetVersionId, { status: "failed" });
      const first = await ctx.db
        .query("importRows")
        .withIndex("by_chunk", (q) => q.eq("batchId", b._id))
        .first();
      if (first)
        await ctx.db.patch(first._id, {
          errors: [args.message ?? "Snapshot validation failed"],
        });
    }
  },
});
export const auditPage = internalQuery({
  args: {
    datasetVersionId: v.id("datasetVersions"),
    table: v.string(),
    cursor: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const version = await ctx.db.get(args.datasetVersionId);
    if (
      !version ||
      !snapshotTables.includes(args.table as (typeof snapshotTables)[number])
    )
      fail("INVALID_INPUT", "Invalid audit source");
    return ctx.db
      .query(args.table as (typeof snapshotTables)[number])
      .withIndex("by_external", (q) =>
        q
          .eq("organizationId", version.organizationId)
          .eq("datasetVersionId", version._id),
      )
      .paginate({ numItems: 100, cursor: args.cursor });
  },
});
export const markVersionReady = internalMutation({
  args: { datasetVersionId: v.id("datasetVersions") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.datasetVersionId, { status: "ready" });
  },
});
export const validateVersion = internalAction({
  args: { datasetVersionId: v.id("datasetVersions") },
  handler: async (ctx, args): Promise<ReturnType<typeof reconcileSnapshot>> => {
    const snapshot = {} as Snapshot;
    let count = 0;
    for (const table of snapshotTables) {
      let cursor: string | null = null;
      const rows = [];
      do {
        const p: {
          page: Snapshot[(typeof snapshotTables)[number]][number][];
          isDone: boolean;
          continueCursor: string;
        } = await ctx.runQuery(internal.imports.auditPage, {
          ...args,
          table,
          cursor,
        });
        rows.push(...p.page);
        count += p.page.length;
        if (count > 50000)
          throw new Error("Prototype import row limit exceeded");
        cursor = p.isDone ? null : p.continueCursor;
      } while (cursor);
      snapshot[table] = rows as never;
    }
    const result = reconcileSnapshot(snapshot);
    await ctx.runMutation(internal.imports.markVersionReady, args);
    return result;
  },
});
export const activate = internalMutation({
  args: {
    datasetVersionId: v.id("datasetVersions"),
    expectedSourceWatermark: v.number(),
  },
  handler: async (ctx, args) => {
    const version = await ctx.db.get(args.datasetVersionId);
    if (!version || version.status !== "ready")
      fail("CONFLICT", "Version is not reconciled");
    const org = await ctx.db.get(version.organizationId);
    if (
      !org ||
      org.sourceWatermark !== args.expectedSourceWatermark ||
      version.baseWatermark !== args.expectedSourceWatermark
    )
      fail(
        "CONFLICT",
        "Data changed during import. Start a fresh snapshot; current data has been preserved.",
      );
    const members = await ctx.db
      .query("memberships")
      .withIndex("by_org", (q) => q.eq("organizationId", org._id))
      .take(101);
    if (members.length > 100)
      fail(
        "CONFLICT",
        "Membership migration exceeds prototype activation limit",
      );
    for (const member of members) {
      const grants = [];
      for (const oldId of member.allowedLocationIds) {
        const old = await ctx.db.get(oldId);
        if (!old) continue;
        const replacement = await ctx.db
          .query("locations")
          .withIndex("by_external", (q) =>
            q
              .eq("organizationId", org._id)
              .eq("datasetVersionId", version._id)
              .eq("externalId", old.externalId),
          )
          .unique();
        if (replacement) grants.push(replacement._id);
      }
      await ctx.db.patch(member._id, { allowedLocationIds: grants });
    }
    await ctx.db.patch(org._id, {
      activeDatasetVersionId: version._id,
      sourceWatermark: org.sourceWatermark + 1,
    });
    await ctx.db.insert("auditEvents", {
      organizationId: org._id,
      actorId: "import-worker",
      operation: "dataset.activate",
      entityId: version._id,
      changes: "Validated dataset activated",
      requestId: version.sourceHash,
      at: Date.now(),
    });
    return { organizationId: org._id, datasetVersionId: version._id };
  },
});
export const advance = internalAction({
  args: {
    batchId: v.id("importBatches"),
    phase: v.union(v.literal("validate"), v.literal("commit")),
  },
  handler: async (ctx, args): Promise<void> => {
    try {
      const batch = await ctx.runQuery(internal.imports.batch, {
        batchId: args.batchId,
      });
      if (!batch) throw new Error("Batch not found");
      const chunks = [];
      let cursor: string | null = null;
      do {
        const p: {
          page: import("./_generated/dataModel").Doc<"importRows">[];
          isDone: boolean;
          continueCursor: string;
        } = await ctx.runQuery(internal.imports.chunkPage, {
          batchId: args.batchId,
          cursor,
        });
        chunks.push(...p.page);
        cursor = p.isDone ? null : p.continueCursor;
      } while (cursor);
      const counts: Record<string, number> = {},
        ids: Record<string, Set<string>> = {};
      for (const chunk of chunks) {
        const table = chunk.chunkKey.split(":")[0];
        ids[table] ??= new Set();
        for (const row of JSON.parse(chunk.rows)) {
          if (ids[table].has(row.id))
            throw new Error(`Duplicate ${table} source ID`);
          ids[table].add(row.id);
          counts[table] = (counts[table] || 0) + 1;
        }
      }
      for (const [table, count] of Object.entries(batch.expectedCounts ?? {}))
        if ((counts[table] ?? 0) !== count)
          throw new Error(`Row count mismatch for ${table}`);
      if (!counts.locations || !counts.products || !counts.variants)
        throw new Error("A complete catalogue/location snapshot is required");
      validateReferences(chunks, ids);
      if (args.phase === "validate") {
        await ctx.runMutation(internal.imports.finish, {
          batchId: args.batchId,
          status: "validated",
        });
        return;
      }
      for (const table of Object.keys(tableMap))
        for (const chunk of chunks.filter((c) =>
          c.chunkKey.startsWith(table + ":"),
        ))
          await ctx.runMutation(internal.imports.writeChunk, {
            rowId: chunk._id,
          });
      await ctx.runAction(internal.imports.validateVersion, {
        datasetVersionId: batch.datasetVersionId,
      });
      const versionBase = await ctx.runQuery(internal.imports.version, {
        datasetVersionId: batch.datasetVersionId,
      });
      await ctx.runMutation(internal.imports.activate, {
        datasetVersionId: batch.datasetVersionId,
        expectedSourceWatermark: versionBase!.baseWatermark,
      });
      await ctx.runMutation(internal.imports.finish, {
        batchId: args.batchId,
        status: "ready",
      });
    } catch (e) {
      await ctx.runMutation(internal.imports.finish, {
        batchId: args.batchId,
        status: "failed",
        message: e instanceof Error ? e.message : "Import failed",
      });
    }
  },
});
export const version = internalQuery({
  args: { datasetVersionId: v.id("datasetVersions") },
  handler: async (ctx, args) => ctx.db.get(args.datasetVersionId),
});
