import type { FunctionArgs } from "convex/server";
import type { api } from "@/convex/_generated/api";
export type CatalogueInput = FunctionArgs<typeof api.catalogue.create>["input"];
