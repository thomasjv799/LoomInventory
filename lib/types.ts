export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  color: string;
  fabric: string;
  craft: string;
  kurtaLength: number;
  style: string;
  collection: string;
  season: string;
  launchDate: string;
  cost: number;
  suggestedMrp: number;
  image: string;
  secondaryImage: string | null;
  sourceProductUrl: string;
  sizes: string[];
  provenance: Record<string, string>;
}
export interface Variant {
  id: string;
  productId: string;
  sku: string;
  size: string;
}
export interface Movement {
  id: string;
  variantId: string;
  locationId: string;
  binId: string;
  condition: string;
  quantity: number;
  date: string;
  reason: string;
  reference: string | null;
}
export interface SalesLine {
  id: string;
  orderId: string;
  variantId: string;
  productId: string;
  locationId: string;
  channel: string;
  date: string;
  quantity: number;
  mrp: number | null;
  netValue: number | null;
  movementId: string;
  dupattaAttached: boolean;
  matchingStatus: string;
  matchingDupattaId?: string;
}
export interface Transfer {
  id: string;
  variantId: string;
  source: string;
  destination: string;
  dispatched: number;
  received: number;
  inTransit: number;
  dispatchDate: string;
  receivedDate: string | null;
  eta: string;
  ownership: string;
}
export interface Event {
  id: string;
  name: string;
  start: string;
  end: string;
  kind: string;
  multiplier: number;
  sourceUrl?: string;
  note?: string;
}
export interface Dataset {
  asOf: string;
  historyStart: string;
  products: Product[];
  variants: Variant[];
  locations: { id: string; name: string; city: string; type: string }[];
  bins: { id: string; locationId: string; name: string; excluded: boolean }[];
  openingInventory: Movement[];
  movements: Movement[];
  sales: SalesLine[];
  transfers: Transfer[];
  balances: {
    variantId: string;
    locationId: string;
    binId: string;
    condition: string;
    quantity: number;
  }[];
  reservations: { variantId: string; locationId: string; quantity: number }[];
  matchingRelationships: {
    outfitId: string;
    dupattaId: string;
    relationship: string;
    ratio: number;
  }[];
  events: Event[];
  influencers: {
    id: string;
    name: string;
    type: string;
    productId: string;
    date: string;
    channel: string;
    note: string;
  }[];
  sizeForecasts: {
    productId: string;
    variantId: string;
    size: string;
    month: string;
    units: number;
    factor: number;
    method: string;
  }[];
  forecasts: {
    productId: string;
    month: string;
    units: number;
    factor: number;
    method: string;
  }[];
  scenarios: { question: number; name: string; productId: string }[];
  metadata: Record<string, string | boolean>;
}
export interface Filters {
  location?: string;
  channel?: string;
  from?: string;
  to?: string;
  q?: string;
  category?: string;
  size?: string;
  fabric?: string;
  color?: string;
  craft?: string;
  status?: string;
}
export interface Settings {
  cover: number;
  peakCover: number;
  minimum: number;
  coreSizes: string[];
  deadDays: number;
  spike: number;
  drop: number;
  fast: number;
  slow: number;
  hit: number;
  average: number;
  freshDays: number;
  peak: boolean;
}
export interface InventoryRow {
  id: string;
  variantId: string;
  productId: string;
  product: Product;
  sku: string;
  size: string;
  locationId: string;
  physical: number;
  sellable: number;
  excluded: number;
  quarantine: number;
  reserved: number;
  available: number;
  inTransit: number;
  sold: number;
  rate: number;
  stockoutDays: number;
  exposure: number;
  cover: number | null;
  status: string;
  lastSale: string | null;
}
export interface Recommendation {
  id: string;
  variantId: string;
  productId: string;
  size: string;
  source: string;
  destination: string;
  quantity: number;
  rate: number;
  available: number;
  incoming: number;
  target: number;
  leadDays: number;
  kind: "Replenish" | "Rotate";
  reason: string;
}
export interface DataProvider {
  load(): Promise<Dataset>;
}
