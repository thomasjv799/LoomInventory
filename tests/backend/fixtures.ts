import { backend } from "./setup";
import { makeFunctionReference } from "convex/server";
export const productInput = {
  sku: "LM-NEW",
  name: "New cotton dress",
  category: "Kurta sets",
  color: "Blue",
  fabric: "Cotton",
  craft: "Printed",
  kurtaLength: 42,
  style: "Straight",
  collection: "Everyday",
  season: "Festive 2026",
  launchDate: "2026-10-06",
  costMinor: 150000,
  suggestedMrpMinor: 300000,
  sizes: ["S", "M"],
  images: [],
};
export async function workspace() {
  const t = backend();
  const ids = await t.run(async (ctx) => {
    const organizationId = await ctx.db.insert("organizations", {
      name: "Demo",
      currency: "INR",
      timezone: "Asia/Kolkata",
      sourceWatermark: 0,
      synthetic: true,
    });
    const datasetVersionId = await ctx.db.insert("datasetVersions", {
      organizationId,
      sourceHash: "test",
      status: "ready",
      asOf: "2026-10-06",
      baseWatermark: 0,
    });
    await ctx.db.patch(organizationId, {
      activeDatasetVersionId: datasetVersionId,
    });
    const locationId = await ctx.db.insert("locations", {
      organizationId,
      datasetVersionId,
      externalId: "HO",
      name: "HO – Central Warehouse",
      city: "Delhi",
      type: "warehouse",
      active: true,
    });
    const binId = await ctx.db.insert("bins", {
      organizationId,
      datasetVersionId,
      externalId: "MAIN",
      locationId,
      name: "Main",
      excludedFromAvailability: false,
    });
    await ctx.db.insert("memberships", {
      authUserId: "admin",
      organizationId,
      role: "administrator",
      allowedLocationIds: [locationId],
      active: true,
      costRead: true,
      networkRead: true,
    });
    return { organizationId, datasetVersionId, locationId, binId };
  });
  return { t, signed: t.withIdentity({ subject: "admin" }), ...ids };
}
