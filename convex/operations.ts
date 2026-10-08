import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAccess, scoped } from "./access";
import { stockEntities, delta } from "./domain/stock";
import { withIdempotency } from "./domain/idempotency";
import { fail, integer } from "./domain/validation";
const base = {
  organizationId: v.id("organizations"),
  variantId: v.id("variants"),
  locationId: v.id("locations"),
  binId: v.id("bins"),
  date: v.string(),
  quantity: v.number(),
  idempotencyKey: v.string(),
};
function receipt(condition: "sellable" | "quarantine", reason: string) {
  return mutation({
    args: base,
    handler: async (ctx, args) => {
      const scope = await requireAccess(ctx, {
        organizationId: args.organizationId,
        capability: "stock",
        locationIds: [args.locationId],
      });
      return withIdempotency(
        ctx,
        scope,
        reason,
        args.idempotencyKey,
        args,
        async () => {
          const eventGroupId = crypto.randomUUID();
          const movementId = await delta(
            ctx,
            scope,
            args,
            condition,
            args.quantity,
            reason,
            eventGroupId,
          );
          return { eventGroupId, movementId };
        },
      );
    },
  });
}
export const receiveStock = receipt("sellable", "stock.receipt");
export const quarantineReturn = receipt("quarantine", "stock.quarantine");
export const releaseQc = mutation({
  args: base,
  handler: async (ctx, args) => {
    const scope = await requireAccess(ctx, {
      organizationId: args.organizationId,
      capability: "stock",
      locationIds: [args.locationId],
    });
    return withIdempotency(
      ctx,
      scope,
      "stock.qc",
      args.idempotencyKey,
      args,
      async () => {
        const eventGroupId = crypto.randomUUID();
        await delta(
          ctx,
          scope,
          args,
          "quarantine",
          -args.quantity,
          "QC release",
          eventGroupId,
        );
        await delta(
          ctx,
          scope,
          args,
          "sellable",
          args.quantity,
          "QC release",
          eventGroupId,
        );
        return { eventGroupId };
      },
    );
  },
});
export const recordSale = mutation({
  args: {
    ...base,
    transactionMrpMinor: v.union(v.number(), v.null()),
    netValueMinor: v.union(v.number(), v.null()),
    channel: v.union(v.literal("Ecommerce"), v.literal("Store")),
  },
  handler: async (ctx, args) => {
    const scope = await requireAccess(ctx, {
      organizationId: args.organizationId,
      capability: "stock",
      locationIds: [args.locationId],
    });
    if (args.transactionMrpMinor !== null)
      integer(args.transactionMrpMinor, "Transaction MRP");
    if (args.netValueMinor !== null)
      integer(args.netValueMinor, "Net selling value");
    return withIdempotency(
      ctx,
      scope,
      "stock.sale",
      args.idempotencyKey,
      args,
      async () => {
        const eventGroupId = crypto.randomUUID(),
          common = {
            organizationId: scope.organizationId,
            datasetVersionId: scope.datasetVersionId!,
          };
        const movementId = await delta(
          ctx,
          scope,
          args,
          "sellable",
          -args.quantity,
          "Sale",
          eventGroupId,
        );
        const orderId = await ctx.db.insert("salesOrders", {
          ...common,
          externalId: eventGroupId,
          locationId: args.locationId,
          channel: args.channel,
          businessDate: args.date,
          sourceReference: args.idempotencyKey,
        });
        const saleId = await ctx.db.insert("salesLines", {
          ...common,
          externalId: eventGroupId,
          orderId,
          variantId: args.variantId,
          quantity: args.quantity,
          transactionMrpMinor: args.transactionMrpMinor,
          netValueMinor: args.netValueMinor,
          linkedMovementId: movementId,
          matchingStatus: "unknown",
          matchingDupattaId: null,
        });
        return { eventGroupId, saleId, movementId };
      },
    );
  },
});
export const dispatchTransfer = mutation({
  args: { ...base, destinationId: v.id("locations"), eta: v.string() },
  handler: async (ctx, args) => {
    const scope = await requireAccess(ctx, {
      organizationId: args.organizationId,
      capability: "stock",
      locationIds: [args.locationId, args.destinationId],
    });
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(args.eta) ||
      !Number.isFinite(Date.parse(args.eta)) ||
      new Date(args.eta).toISOString().slice(0, 10) !== args.eta ||
      args.locationId === args.destinationId ||
      args.eta < args.date
    )
      fail("INVALID_INPUT", "Invalid destination or ETA");
    return withIdempotency(
      ctx,
      scope,
      "stock.dispatch",
      args.idempotencyKey,
      args,
      async () => {
        const eventGroupId = crypto.randomUUID();
        await delta(
          ctx,
          scope,
          args,
          "sellable",
          -args.quantity,
          "Transfer dispatch",
          eventGroupId,
        );
        const transferId = await ctx.db.insert("transfers", {
          organizationId: scope.organizationId,
          datasetVersionId: scope.datasetVersionId!,
          externalId: eventGroupId,
          sourceId: args.locationId,
          destinationId: args.destinationId,
          variantId: args.variantId,
          dispatched: args.quantity,
          received: 0,
          eta: args.eta,
          dispatchDate: args.date,
          ownerOrganizationId: scope.organizationId,
          status: "in_transit",
        });
        return { eventGroupId, transferId };
      },
    );
  },
});
export const receiveTransfer = mutation({
  args: {
    organizationId: v.id("organizations"),
    transferId: v.id("transfers"),
    binId: v.id("bins"),
    quantity: v.number(),
    date: v.string(),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    const scope = await requireAccess(ctx, {
      organizationId: args.organizationId,
      capability: "stock",
    });
    const t = scoped(await ctx.db.get(args.transferId), scope);
    await requireAccess(ctx, {
      organizationId: args.organizationId,
      capability: "stock",
      locationIds: [t.sourceId, t.destinationId],
    });
    return withIdempotency(
      ctx,
      scope,
      "stock.transferReceipt",
      args.idempotencyKey,
      args,
      async () => {
        integer(args.quantity, "Quantity", 1);
        if (t.received + args.quantity > t.dispatched)
          fail("CONFLICT", "Transfer over-receipt");
        const eventGroupId = crypto.randomUUID();
        const movementId = await delta(
          ctx,
          scope,
          {
            variantId: t.variantId,
            locationId: t.destinationId,
            binId: args.binId,
            date: args.date,
            quantity: args.quantity,
          },
          "sellable",
          args.quantity,
          "Transfer receipt",
          eventGroupId,
        );
        const received = t.received + args.quantity;
        await ctx.db.patch(t._id, {
          received,
          status: received === t.dispatched ? "received" : "in_transit",
        });
        await ctx.db.insert("transferReceipts", {
          organizationId: scope.organizationId,
          datasetVersionId: scope.datasetVersionId!,
          externalId: eventGroupId,
          transferId: t._id,
          quantity: args.quantity,
          receiptDate: args.date,
          linkedMovementId: movementId,
        });
        return { eventGroupId, received };
      },
    );
  },
});
export const moveBin = mutation({
  args: {
    ...base,
    destinationBinId: v.id("bins"),
    condition: v.union(v.literal("sellable"), v.literal("quarantine")),
  },
  handler: async (ctx, args) => {
    const scope = await requireAccess(ctx, {
      organizationId: args.organizationId,
      capability: "stock",
      locationIds: [args.locationId],
    });
    if (args.binId === args.destinationBinId)
      fail("INVALID_INPUT", "Choose another bin");
    return withIdempotency(
      ctx,
      scope,
      "stock.binMove",
      args.idempotencyKey,
      args,
      async () => {
        const eventGroupId = crypto.randomUUID();
        await delta(
          ctx,
          scope,
          args,
          args.condition,
          -args.quantity,
          "Bin move",
          eventGroupId,
        );
        await delta(
          ctx,
          scope,
          { ...args, binId: args.destinationBinId },
          args.condition,
          args.quantity,
          "Bin move",
          eventGroupId,
        );
        return { eventGroupId };
      },
    );
  },
});
