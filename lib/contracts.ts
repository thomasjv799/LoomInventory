import type { Filters } from "./types";
export function validateFilters(input: unknown): Filters {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("INVALID_INPUT: Filters must be an object");
  const allowed = [
    "location",
    "channel",
    "from",
    "to",
    "q",
    "category",
    "size",
    "fabric",
    "color",
    "craft",
    "status",
  ];
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (
      !allowed.includes(key) ||
      typeof value !== "string" ||
      value.length > 250
    )
      throw new Error("INVALID_INPUT: Unknown or invalid filter");
    if (value) result[key] = value;
  }
  for (const key of ["from", "to"])
    if (
      result[key] &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(result[key]) ||
        !Number.isFinite(Date.parse(result[key])) ||
        new Date(result[key]).toISOString().slice(0, 10) !== result[key])
    )
      throw new Error("INVALID_INPUT: Invalid date");
  if (result.from && result.to && result.from > result.to)
    throw new Error("INVALID_INPUT: Date range is reversed");
  if (result.channel && !["Ecommerce", "Store"].includes(result.channel))
    throw new Error("INVALID_INPUT: Invalid sales channel");
  return result;
}
