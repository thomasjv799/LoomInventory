import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAccess, scoped } from "./access";
import { integer, fail } from "./domain/validation";
import { withIdempotency } from "./domain/idempotency";
export const productInputValidator = v.object({
  sku: v.string(),
  name: v.string(),
  category: v.string(),
  color: v.string(),
  fabric: v.string(),
  craft: v.string(),
  kurtaLength: v.number(),
  style: v.string(),
  collection: v.string(),
  season: v.string(),
  launchDate: v.string(),
  costMinor: v.number(),
  suggestedMrpMinor: v.number(),
  sizes: v.array(v.string()),
  images: v.array(
    v.object({
      url: v.string(),
      sourceProductUrl: v.string(),
      alt: v.string(),
      width: v.number(),
      height: v.number(),
    }),
  ),
});
export const resolve = query({
  args: { organizationId: v.id("organizations"), externalId: v.string() },
  handler: async (ctx, args) => {
    const scope = await requireAccess(ctx, {
      organizationId: args.organizationId,
      capability: "read",
    });
    if (!scope.datasetVersionId) fail("NOT_FOUND", "No active catalogue");
    const product = await ctx.db
      .query("products")
      .withIndex("by_external", (q) =>
        q
          .eq("organizationId", scope.organizationId)
          .eq("datasetVersionId", scope.datasetVersionId!)
          .eq("externalId", args.externalId),
      )
      .unique();
    if (!product) fail("NOT_FOUND", "Product not found");
    return { productId: product._id, externalId: product.externalId };
  },
});
function validate(input: typeof productInputValidator.type) {
  if (!Number.isFinite(input.kurtaLength) || input.kurtaLength < 0)
    fail("INVALID_INPUT", "Kurta length must be finite and nonnegative");
  integer(input.costMinor, "Cost");
  integer(input.suggestedMrpMinor, "Suggested MRP");
  if (
    !input.sku.trim() ||
    !input.name.trim() ||
    input.sku.length > 100 ||
    input.name.length > 250
  )
    fail("INVALID_INPUT", "SKU and name required");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(input.launchDate) ||
    !Number.isFinite(Date.parse(input.launchDate)) ||
    new Date(input.launchDate).toISOString().slice(0, 10) !== input.launchDate
  )
    fail("INVALID_INPUT", "Invalid launch date");
  if (
    !input.sizes.length ||
    input.sizes.length > 12 ||
    new Set(input.sizes).size !== input.sizes.length ||
    input.sizes.some(
      (s) =>
        !["XS", "S", "M", "L", "XL", "XXL", "3XL", "Free size"].includes(s),
    )
  )
    fail("INVALID_INPUT", "Select unique supported sizes");
  if (input.images.length > 4)
    fail("INVALID_INPUT", "Maximum four image references");
  for (const i of input.images) {
    try {
      if (
        new URL(i.url).protocol !== "https:" ||
        new URL(i.sourceProductUrl).protocol !== "https:"
      )
        fail("INVALID_INPUT", "Use HTTPS image/source URLs");
      integer(i.width, "Image width", 1);
      integer(i.height, "Image height", 1);
    } catch {
      fail(
        "INVALID_INPUT",
        "Use valid HTTPS references and positive image dimensions",
      );
    }
  }
}
export const create = mutation({
  args: {
    organizationId: v.id("organizations"),
    input: productInputValidator,
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    const scope = await requireAccess(ctx, {
      organizationId: args.organizationId,
      capability: "catalogue",
    });
    validate(args.input);
    if (!scope.datasetVersionId) fail("CONFLICT", "No active dataset");
    return withIdempotency(
      ctx,
      scope,
      "catalogue.create",
      args.idempotencyKey,
      args.input,
      async () => {
        const duplicate = await ctx.db
          .query("products")
          .withIndex("by_sku", (q) =>
            q
              .eq("organizationId", scope.organizationId)
              .eq("datasetVersionId", scope.datasetVersionId!)
              .eq("sku", args.input.sku),
          )
          .unique();
        if (duplicate) fail("CONFLICT", "Duplicate product SKU");
        const { sizes, images, ...fields } = args.input;
        const common = {
          organizationId: scope.organizationId,
          datasetVersionId: scope.datasetVersionId!,
        };
        const externalId = "P-" + crypto.randomUUID();
        const productId = await ctx.db.insert("products", {
          ...common,
          ...fields,
          externalId,
          provenance: { attributes: "operator-entered", stock: "not received" },
          archived: false,
          version: 1,
        });
        for (const size of sizes)
          await ctx.db.insert("variants", {
            ...common,
            externalId: externalId + "-" + size,
            productId,
            size,
            sku: fields.sku + "-" + size,
            active: true,
          });
        for (const [index, image] of images.entries())
          await ctx.db.insert("productImages", {
            ...common,
            ...image,
            externalId: externalId + "-" + index,
            productId,
            verifiedOn: null,
          });
        return { productId, externalId, version: 1, stock: 0 };
      },
    );
  },
});
export const list = query({
  args: {
    organizationId: v.id("organizations"),
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const scope = await requireAccess(ctx, {
      organizationId: args.organizationId,
      capability: "read",
    });
    const limit = args.limit ?? 25;
    integer(limit, "Limit", 1);
    if (limit > 100) fail("INVALID_INPUT", "Maximum limit is 100");
    if (!scope.datasetVersionId) return { data: [], nextCursor: null };
    const page = await ctx.db
      .query("products")
      .withIndex("by_external", (q) =>
        q
          .eq("organizationId", scope.organizationId)
          .eq("datasetVersionId", scope.datasetVersionId!),
      )
      .paginate({ numItems: limit, cursor: args.cursor ?? null });
    return {
      data: await Promise.all(
        page.page.map(async (p) => ({
          ...p,
          costMinor: scope.costRead ? p.costMinor : null,
          image:
            (
              await ctx.db
                .query("productImages")
                .withIndex("by_product", (q) => q.eq("productId", p._id))
                .first()
            )?.url ?? "",
        })),
      ),
      nextCursor: page.isDone ? null : page.continueCursor,
    };
  },
});
export const detail = query({
  args: { organizationId: v.id("organizations"), productId: v.id("products") },
  handler: async (ctx, args) => {
    const scope = await requireAccess(ctx, {
      organizationId: args.organizationId,
      capability: "read",
    });
    const p = scoped(await ctx.db.get(args.productId), scope);
    const variants = await ctx.db
      .query("variants")
      .withIndex("by_product", (q) => q.eq("productId", p._id))
      .take(12);
    const images = await ctx.db
      .query("productImages")
      .withIndex("by_product", (q) => q.eq("productId", p._id))
      .take(4);
    const balances = [];
    for (const variant of variants)
      for (const locationId of scope.allowedLocationIds)
        balances.push(
          ...(await ctx.db
            .query("stockBalances")
            .withIndex("by_stock", (q) =>
              q
                .eq("organizationId", scope.organizationId)
                .eq("datasetVersionId", scope.datasetVersionId!)
                .eq("variantId", variant._id)
                .eq("locationId", locationId),
            )
            .take(32)),
        );
    const historyLocationId = scope.allowedLocationIds[0];
    const movements = [];
    if (historyLocationId)
      for (const variant of variants)
        movements.push(
          ...(await ctx.db
            .query("inventoryLedger")
            .withIndex("by_variant_location", (q) =>
              q
                .eq("organizationId", scope.organizationId)
                .eq("datasetVersionId", scope.datasetVersionId!)
                .eq("variantId", variant._id)
                .eq("locationId", historyLocationId),
            )
            .order("desc")
            .take(5)),
        );
    movements.sort(
      (a, b) =>
        b.effectiveAt.localeCompare(a.effectiveAt) ||
        b.recordedAt - a.recordedAt,
    );
    return {
      product: { ...p, costMinor: scope.costRead ? p.costMinor : null },
      variants,
      images,
      balances,
      movements: movements.slice(0, 25),
      historyLocationId,
    };
  },
});
export const update = mutation({
  args: {
    organizationId: v.id("organizations"),
    productId: v.id("products"),
    input: productInputValidator,
    expectedVersion: v.number(),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    const scope = await requireAccess(ctx, {
      organizationId: args.organizationId,
      capability: "catalogue",
    });
    validate(args.input);
    return withIdempotency(
      ctx,
      scope,
      "catalogue.update",
      args.idempotencyKey,
      args,
      async () => {
        const p = scoped(await ctx.db.get(args.productId), scope);
        if (p.version !== args.expectedVersion)
          fail("CONFLICT", "Stale product version");
        const variants = await ctx.db
          .query("variants")
          .withIndex("by_product", (q) => q.eq("productId", p._id))
          .take(12);
        if (
          args.input.sku !== p.sku ||
          args.input.sizes.slice().sort().join() !==
            variants
              .map((x) => x.size)
              .sort()
              .join()
        )
          fail("INVALID_INPUT", "SKU and established sizes are immutable");
        const { sizes, images, ...fields } = args.input;
        await ctx.db.patch(p._id, { ...fields, version: p.version + 1 });
        for (const old of await ctx.db
          .query("productImages")
          .withIndex("by_product", (q) => q.eq("productId", p._id))
          .take(4))
          await ctx.db.delete(old._id);
        for (const [index, image] of images.entries())
          await ctx.db.insert("productImages", {
            organizationId: scope.organizationId,
            datasetVersionId: scope.datasetVersionId!,
            externalId: p.externalId + "-" + index,
            productId: p._id,
            ...image,
            verifiedOn: null,
          });
        return { productId: p._id, version: p.version + 1 };
      },
    );
  },
});
export const archive = mutation({
  args: {
    organizationId: v.id("organizations"),
    productId: v.id("products"),
    expectedVersion: v.number(),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    const scope = await requireAccess(ctx, {
      organizationId: args.organizationId,
      capability: "catalogue",
    });
    return withIdempotency(
      ctx,
      scope,
      "catalogue.archive",
      args.idempotencyKey,
      args,
      async () => {
        const p = scoped(await ctx.db.get(args.productId), scope);
        if (p.version !== args.expectedVersion)
          fail("CONFLICT", "Stale product version");
        await ctx.db.patch(p._id, { archived: true, version: p.version + 1 });
        return { productId: p._id, version: p.version + 1 };
      },
    );
  },
});
