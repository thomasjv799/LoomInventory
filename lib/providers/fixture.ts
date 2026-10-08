import { filtersForReport } from "../report-filters";
import { fixtureProvider } from "../provider";
import { defaults } from "../analytics";
import { buildReport } from "../report-adapters";
import type {
  InventoryProvider,
  ReportName,
  ReportEnvelope,
} from "../report-types";
import type { Filters, Settings } from "../types";
export class FixtureInventoryProvider implements InventoryProvider {
  private settings = { ...defaults };
  private version = 0;
  async getSettings() {
    return { values: this.settings, version: this.version };
  }
  async updateSettings(values: Settings, expectedVersion: number) {
    if (expectedVersion !== this.version) throw new Error("Stale settings");
    this.settings = values;
    return { values, version: ++this.version };
  }
  async getReport(
    name: ReportName,
    filters: Filters,
    page?: { cursor?: string; limit?: number },
  ): Promise<ReportEnvelope> {
    const d = await fixtureProvider.load(),
      result = buildReport(d, name, filters, this.settings),
      offset = Number(page?.cursor || 0),
      limit = page?.limit ?? 25;
    const { rows, ...prepared } = result;
    return {
      ...prepared,
      data: rows.slice(offset, offset + limit),
      meta: {
        asOf: d.asOf,
        synthetic: true,
        currency: "INR",
        timezone: "Asia/Kolkata",
        sourceWatermark: 0,
        settingsVersion: this.version,
        algorithmVersion: "demo-v1",
        appliedFilters: filtersForReport(name, filters).applied,
        ignoredFilters: filtersForReport(name, filters).ignored,
        nextCursor:
          offset + limit < rows.length ? String(offset + limit) : null,
        requestId: "fixture",
      },
    };
  }
}
