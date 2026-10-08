import { defineSchema, defineTable } from "convex/server";
import { v, type GenericValidator } from "convex/values";
const scope = {
  organizationId: v.id("organizations"),
  datasetVersionId: v.id("datasetVersions"),
  externalId: v.string(),
};
export const settingsValidator = v.object({
  cover: v.number(),
  peakCover: v.number(),
  minimum: v.number(),
  coreSizes: v.array(v.string()),
  deadDays: v.number(),
  spike: v.number(),
  drop: v.number(),
  fast: v.number(),
  slow: v.number(),
  hit: v.number(),
  average: v.number(),
  freshDays: v.number(),
  peak: v.boolean(),
});
export default defineSchema({
  organizations: defineTable({
    name: v.string(),
    currency: v.literal("INR"),
    timezone: v.literal("Asia/Kolkata"),
    activeDatasetVersionId: v.optional(v.id("datasetVersions")),
    sourceWatermark: v.number(),
    synthetic: v.boolean(),
  }),
  datasetVersions: defineTable({
    organizationId: v.id("organizations"),
    sourceHash: v.string(),
    status: v.union(
      v.literal("staged"),
      v.literal("ready"),
      v.literal("failed"),
    ),
    asOf: v.string(),
    baseWatermark: v.number(),
  }),
  memberships: defineTable({
    authUserId: v.string(),
    organizationId: v.id("organizations"),
    role: v.union(
      v.literal("viewer"),
      v.literal("merchandiser"),
      v.literal("operator"),
      v.literal("administrator"),
    ),
    allowedLocationIds: v.array(v.id("locations")),
    active: v.boolean(),
    costRead: v.boolean(),
    networkRead: v.boolean(),
  })
    .index("by_user", ["authUserId", "organizationId"])
    .index("by_org", ["organizationId"]),
  locations: defineTable({
    ...scope,
    ...{
      name: v.string(),
      city: v.string(),
      type: v.string(),
      active: v.boolean(),
    },
  }).index("by_external", ["organizationId", "datasetVersionId", "externalId"]),
  bins: defineTable({
    ...scope,
    ...{
      locationId: v.id("locations"),
      name: v.string(),
      excludedFromAvailability: v.boolean(),
    },
  }).index("by_external", ["organizationId", "datasetVersionId", "externalId"]),
  products: defineTable({
    ...scope,
    ...{
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
      provenance: v.record(v.string(), v.string()),
      archived: v.boolean(),
      version: v.number(),
    },
  })
    .index("by_external", ["organizationId", "datasetVersionId", "externalId"])
    .index("by_sku", ["organizationId", "datasetVersionId", "sku"]),
  variants: defineTable({
    ...scope,
    ...{
      productId: v.id("products"),
      size: v.string(),
      sku: v.string(),
      active: v.boolean(),
    },
  })
    .index("by_external", ["organizationId", "datasetVersionId", "externalId"])
    .index("by_product", ["productId"]),
  productImages: defineTable({
    ...scope,
    ...{
      productId: v.id("products"),
      url: v.string(),
      sourceProductUrl: v.string(),
      alt: v.string(),
      width: v.union(v.number(), v.null()),
      height: v.union(v.number(), v.null()),
      verifiedOn: v.union(v.string(), v.null()),
    },
  })
    .index("by_external", ["organizationId", "datasetVersionId", "externalId"])
    .index("by_product", ["productId"]),
  inventoryLedger: defineTable({
    ...scope,
    ...{
      eventGroupId: v.string(),
      variantId: v.id("variants"),
      locationId: v.id("locations"),
      binId: v.id("bins"),
      condition: v.string(),
      quantityDelta: v.number(),
      effectiveAt: v.string(),
      recordedAt: v.number(),
      reason: v.string(),
      sourceId: v.union(v.string(), v.null()),
      actorId: v.string(),
    },
  })
    .index("by_external", ["organizationId", "datasetVersionId", "externalId"])
    .index("by_variant_location", [
      "organizationId",
      "datasetVersionId",
      "variantId",
      "locationId",
      "effectiveAt",
    ]),
  stockBalances: defineTable({
    ...scope,
    ...{
      variantId: v.id("variants"),
      locationId: v.id("locations"),
      binId: v.id("bins"),
      condition: v.string(),
      quantity: v.number(),
      watermark: v.number(),
    },
  })
    .index("by_external", ["organizationId", "datasetVersionId", "externalId"])
    .index("by_stock", [
      "organizationId",
      "datasetVersionId",
      "variantId",
      "locationId",
    ])
    .index("by_location", ["organizationId", "datasetVersionId", "locationId"]),
  salesOrders: defineTable({
    ...scope,
    ...{
      locationId: v.id("locations"),
      channel: v.string(),
      businessDate: v.string(),
      sourceReference: v.string(),
    },
  }).index("by_external", ["organizationId", "datasetVersionId", "externalId"]),
  salesLines: defineTable({
    ...scope,
    ...{
      orderId: v.id("salesOrders"),
      variantId: v.id("variants"),
      quantity: v.number(),
      transactionMrpMinor: v.union(v.number(), v.null()),
      netValueMinor: v.union(v.number(), v.null()),
      linkedMovementId: v.id("inventoryLedger"),
      matchingStatus: v.string(),
      matchingDupattaId: v.union(v.id("products"), v.null()),
    },
  }).index("by_external", ["organizationId", "datasetVersionId", "externalId"]),
  transfers: defineTable({
    ...scope,
    ...{
      sourceId: v.id("locations"),
      destinationId: v.id("locations"),
      variantId: v.id("variants"),
      dispatched: v.number(),
      received: v.number(),
      eta: v.string(),
      dispatchDate: v.string(),
      ownerOrganizationId: v.id("organizations"),
      status: v.string(),
    },
  }).index("by_external", ["organizationId", "datasetVersionId", "externalId"]),
  transferReceipts: defineTable({
    ...scope,
    ...{
      transferId: v.id("transfers"),
      quantity: v.number(),
      receiptDate: v.string(),
      linkedMovementId: v.id("inventoryLedger"),
    },
  }).index("by_external", ["organizationId", "datasetVersionId", "externalId"]),
  reservations: defineTable({
    ...scope,
    ...{
      variantId: v.id("variants"),
      locationId: v.id("locations"),
      quantity: v.number(),
    },
  })
    .index("by_external", ["organizationId", "datasetVersionId", "externalId"])
    .index("by_stock", [
      "organizationId",
      "datasetVersionId",
      "variantId",
      "locationId",
    ]),
  matchingRelationships: defineTable({
    ...scope,
    ...{
      outfitId: v.id("products"),
      dupattaId: v.id("products"),
      relationship: v.string(),
      ratio: v.number(),
    },
  }).index("by_external", ["organizationId", "datasetVersionId", "externalId"]),
  influencerActivity: defineTable({
    ...scope,
    ...{
      productId: v.id("products"),
      name: v.string(),
      type: v.string(),
      date: v.string(),
      channel: v.string(),
      note: v.string(),
    },
  }).index("by_external", ["organizationId", "datasetVersionId", "externalId"]),
  events: defineTable({
    ...scope,
    ...{
      name: v.string(),
      start: v.string(),
      end: v.string(),
      kind: v.string(),
      multiplier: v.number(),
      sourceUrl: v.union(v.string(), v.null()),
      note: v.union(v.string(), v.null()),
    },
  }).index("by_external", ["organizationId", "datasetVersionId", "externalId"]),
  forecastRuns: defineTable({
    ...scope,
    ...{
      asOf: v.string(),
      scope: v.string(),
      status: v.string(),
      assumptions: v.string(),
    },
  }).index("by_external", ["organizationId", "datasetVersionId", "externalId"]),
  forecastValues: defineTable({
    ...scope,
    ...{
      runId: v.id("forecastRuns"),
      variantId: v.id("variants"),
      month: v.string(),
      units: v.number(),
      factor: v.number(),
      method: v.string(),
    },
  }).index("by_external", ["organizationId", "datasetVersionId", "externalId"]),
  organizationSettings: defineTable({
    organizationId: v.id("organizations"),
    values: settingsValidator,
    version: v.number(),
  }).index("by_org", ["organizationId"]),
  idempotency: defineTable({
    organizationId: v.id("organizations"),
    operation: v.string(),
    key: v.string(),
    hash: v.string(),
    result: v.string(),
  }).index("by_key", ["organizationId", "operation", "key"]),
  auditEvents: defineTable({
    organizationId: v.id("organizations"),
    actorId: v.string(),
    operation: v.string(),
    entityId: v.string(),
    changes: v.string(),
    requestId: v.string(),
    at: v.number(),
  }),
  importBatches: defineTable({
    organizationId: v.id("organizations"),
    datasetVersionId: v.id("datasetVersions"),
    datasetType: v.string(),
    sourceHash: v.string(),
    status: v.string(),
    cursor: v.union(v.string(), v.null()),
    rows: v.number(),
    rejected: v.number(),
    expectedCounts: v.optional(v.record(v.string(), v.number())),
    cutoff: v.optional(v.string()),
  }).index("by_hash", ["organizationId", "sourceHash"]),
  importRows: defineTable({
    batchId: v.id("importBatches"),
    chunkKey: v.string(),
    hash: v.string(),
    rows: v.string(),
    status: v.string(),
    errors: v.array(v.string()),
  }).index("by_chunk", ["batchId", "chunkKey"]),
  dailySales: defineTable({
    ...scope,
    ...{
      locationId: v.id("locations"),
      variantId: v.id("variants"),
      date: v.string(),
      units: v.number(),
      netValueMinor: v.number(),
      pricedUnits: v.number(),
    },
  })
    .index("by_external", ["organizationId", "datasetVersionId", "externalId"])
    .index("by_date", ["organizationId", "datasetVersionId", "date"]),
  stockExposure: defineTable({
    ...scope,
    ...{
      variantId: v.id("variants"),
      locationId: v.id("locations"),
      start: v.string(),
      end: v.union(v.string(), v.null()),
      available: v.number(),
    },
  }).index("by_external", ["organizationId", "datasetVersionId", "externalId"]),
  reportRuns: defineTable({
    organizationId: v.id("organizations"),
    datasetVersionId: v.id("datasetVersions"),
    authUserId: v.string(),
    scopeHash: v.string(),
    name: v.string(),
    filters: v.string(),
    sourceWatermark: v.number(),
    settingsVersion: v.number(),
    algorithmVersion: v.string(),
    status: v.string(),
    totals: v.string(),
    expiresAt: v.number(),
    checkpoint: v.string(),
  }),
  reportRows: defineTable({
    runId: v.id("reportRuns"),
    position: v.number(),
    payload: v.string(),
  }).index("by_run", ["runId", "position"]),
});
