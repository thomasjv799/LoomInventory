# Metric definitions

The implemented definitions live in `lib/analytics.ts` and section assembly in `components/dashboard.tsx`. Keep backend report tests aligned with these definitions before changing the provider. Quantities are units. All money is INR minor units (paise), rendered by dividing by 100.

| Metric                     | Implemented calculation and interpretation                                                                                                                                                            |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Physical stock             | Sum of opening and signed ledger movements for each variant/location/bin/condition. Does not include units between locations.                                                                         |
| Sellable stock             | Sellable-condition balances in non-excluded bins.                                                                                                                                                     |
| Available                  | `max(0, sellable − active reserved quantity)`. Transit and quarantine never add availability.                                                                                                         |
| Dispatch exclusion         | Bin-level excluded balance. Physical stock retains it. Exclusion and quarantine are attributes that can overlap; do not blindly subtract both totals from physical.                                   |
| Selling-size stockout      | Available = 0 and sold units > 0 in the latest 28 complete days.                                                                                                                                      |
| Exposure                   | Days in that 28-day window with reconstructed closing sellable stock > 0, or a recorded sale. Uses closing stock before subtracting that day's movement to step backwards.                            |
| Stockout days              | 28 − exposure. A daily closing-stock proxy, not an intraday duration or lost-sales estimate. Reservations do not adjust the historical exposure proxy.                                                |
| Demand rate                | Latest 28-day sales units ÷ exposure; zero when exposure is absent.                                                                                                                                   |
| Days of cover              | Available ÷ rate. Null when rate = 0.                                                                                                                                                                 |
| Low stock                  | Available > 0 and cover below the active configured cover. Zero available is Stockout.                                                                                                                |
| Inactive                   | Available > 0 and last sale earlier than `as_of − deadDays`; never-sold styles need launch date at least deadDays old. Defaults to 60 days.                                                           |
| Slow stock                 | Available units with positive rate at or below the configured slow threshold, or inactive stock.                                                                                                      |
| Recipient target           | `max(minimum, ceil(rate × (active_cover + 3)))`. Three days are an assumed lead time.                                                                                                                 |
| Recipient gap              | `max(0, target − available − timely incoming)`. Incoming ETA must be within the target horizon.                                                                                                       |
| Donor excess               | Unallocated source availability minus `max(minimum, ceil(source_rate × (active_cover + 3)))`, floored at zero. HO ecommerce demand is protected too.                                                  |
| Suggested quantity         | Minimum of donor excess and remaining recipient gap. Recipients ordered by cover, then rate, then identity. Source pools decremented after each suggestion.                                           |
| Healthy option             | Every applicable configured core size has at least minimum available units; core size intersection must be non-empty. Dupattas are excluded from outfit-option counts.                                |
| Broken option              | Outfit option failing the healthy test. This includes unavailable options in the demo's full style/store assortment; future assortment listings must define which styles a store actually ranges.     |
| Freshness                  | Available outfit units belonging to Festive 2026 styles launched within freshDays ÷ available outfit units. Current-season selection is hardcoded in the prototype.                                   |
| Sell-through               | Latest 30-day sales ÷ (eligible sellable opening stock at window start + positive eligible receipts in window), capped at 100%. Evidence requires at least one size with 14 exposure days.            |
| Hit / Average / Miss       | With sufficient evidence, sell-through >= hit → Hit; >= average → Average; otherwise Miss. Without evidence → Insufficient data.                                                                      |
| Sales trend                | `(current_units − previous_units) / previous_units × 100`; adjacent fixed 7- or 10-day windows ending before as_of. Null when previous units = 0.                                                     |
| Actual unit price          | Net line value ÷ quantity, using sales records only. Missing net values are omitted from bands, not replaced by product MRP.                                                                          |
| Attribute revenue          | Sum of known net line values per attribute; unknown values contribute no known revenue. Units still count. Backend responses should add price-completeness counts.                                    |
| Dupatta attachment         | With units ÷ (with + without units) × 100. Unknown units excluded and shown separately. Null when no known observations.                                                                              |
| Matching coverage          | Allocated available matching dupatta units ÷ available outfit units × 100. A shared matching pool is consumed once; null if no outfit stock.                                                          |
| Forecast                   | Fixed 28-day network sales daily baseline × calendar days × simulated seasonal factor; allocated to sizes by observed size mix using largest remainder. Not the exposure-adjusted replenishment rate. |
| Replenishment elapsed time | Fixture receipt date − dispatch date, in days. Partial remaining quantities stay in transit.                                                                                                          |

## Important distinctions

Historical date filters affect transaction-based tables and charts. Current stock, exposure, cover and inactivity use the snapshot and fixed recent history. Trend windows intentionally ignore the historical period. Forecasts are network projections; store/channel filters do not turn them into store forecasts. The upcoming API must return applied filters and ignored filters explicitly to retain these distinctions.

Twenty-four calendar months are represented, but sales older than 90 days are sampled every 28 days. Treat the older series as synthetic demonstration history, not dense daily training data. Creator timing demonstrates association only. No forecast confidence interval, stockout-censored demand model, returns propensity or causal marketing model is implemented.

Production decisions still required: actual ranged store assortment, selling-price definition including tax/discount allocation, season master, lead-time distribution, stockout granularity, reservation lifecycle, and size ratios based on uncensored demand. The prototype does not claim to have solved these by changing thresholds.
