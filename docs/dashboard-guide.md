# Dashboard guide

## Purpose and boundaries

Inventory Studio helps a merchandising team identify unavailable selling sizes, excess stock, rotation opportunities and matching-dupatta gaps. The prototype answers the fifteen requested business questions using one coherent synthetic ledger. It provides reviewable suggestions; clicking a recommendation does not create a transfer or alter stock.

The snapshot is 6 October 2026. Sales end on 5 October. The warehouse is labelled **HO – Central Warehouse** and supplies ecommerce. Five fictional stores are Delhi South Extension, Mumbai Kala Ghoda, Bengaluru Indiranagar, Jaipur C-Scheme and Hyderabad Jubilee Hills. These names, operations, quantities and prices do not describe The Loom's actual stores or trading.

## Shared controls

- The sidebar opens all eight sections. On smaller screens, use **Open navigation**. Page headings use the section name and a short description, with the reports taking visual priority.
- **Store or warehouse** restricts the location; **Sales channel** distinguishes ecommerce and store sales. For inventory, ecommerce means HO stock and the store channel means store stock, rather than separate stock ownership.
- **Date period** offers 7, 28, 90 days, the full history or a custom inclusive range. It changes transaction reports. Inventory remains the current snapshot; its cover and stockout measures retain their fixed recent windows.
- Search accepts a product name, product SKU (`LM-P001`) or sized variant SKU (`LM-P001-M`). Additional filters include category, size, fabric, colour and craft. Status filters are available on stock reports.
- Filters are kept in the URL, so a report link preserves its context. Sorting and pagination are table controls; they are not saved in the URL. Export includes the complete filtered primary report, rather than only the current table page.
- Catalogue/location choices show matching counts and disable incompatible choices. Counts refer to sales lines on Sales & Attributes and inventory rows on stock reports; Stores counts outfit rows and Dupatta Analysis counts mapped outfits. Replenishment uses inventory counts so inbound-only variants and HO production candidates remain selectable. These counts are not a promise that every secondary action table has a recommendation.
- Active styles have recent demo sales for every applicable size at every location, even in the seven-day preset. Two intentionally inactive styles retain genuine no-sale examples. Impossible size/category or location/channel combinations, unmatched searches and custom dates without evidence remain empty. For a deep-filter example, choose Delhi → Stores → Last 7 days → Suit sets → Chanderi → Pink → Embroidered → M: five sales lines match.
- Product buttons open a drawer with the source image, attributes, sizes, location availability, movements, sales and rationale. Close it with its close control or Escape; keyboard focus returns to the opener.
- Charts offer tooltips and a **Show ... data table** alternative. Colour-coded statuses also have labels. Missing images use a labelled fallback.

## 1. Overview

Use the overview to decide which report needs attention first. Available stock, selling-size stockouts, broken options and inactive units link to the relevant report. The attention table shows selling-size shortages and held inactive stock, with a suggested next step. Demand history, replenishment recommendations and seven-/ten-day changes give context.

Example: search `LM-P001` and review its store-size shortages, then open a recommendation to see the available HO supply and protected donor cover. A low or zero sales baseline can mean insufficient evidence; it is not automatically a demand forecast.

## 2. Inventory

The location table displays SKU, size, physical/sellable stock, exclusions, reservations, available stock, incoming transit and recent sales. The size matrix groups styles for comparison across applicable sizes. Open a product drawer to compare HO with stores before interpreting a zero as a network shortage.

Use **Selling stockout** for recently selling sizes with no available stock, **Low stock** for insufficient configured cover and **Inactive** for held inventory beyond the inactivity window. Ecommerce plus Inactive supports dead-stock review. Dispatch center and quarantined quantities remain visible but unavailable; incoming stock is separate until received.

## 3. Stores & Rotation

This report covers retail stores only. Its Store filter lists the five stores, and warehouse/ecommerce selections carried from another report are cleared with a notice. Use Inventory for HO stock and Replenishment for HO-to-store supply and production shortages.

Store cards and assortment rows compare healthy/broken outfit options, freshness and Hit/Average/Miss classifications. A healthy option has the required quantity in every applicable core size. Freshness is a share of available outfit units, rather than a percentage of all styles.

The rotation report pairs donor excess with a recipient's gap. Suggestions protect each donor's demand and allocate a shared stock pool once. The slow-stock report identifies available units with low rates or long inactivity. Review sales exposure, season and fit before treating slow stock as an outward instruction.

## 4. Sales & Attributes

Actual selling-price bands and size mix describe transaction demand. Fabric, craft, colour and style reports show units, revenue and units per selling style. Select a store to compare its preferences. The transaction table retains its own MRP and net value; product suggested MRP is never substituted for a missing sales price.

Seven-day increases compare the latest seven complete days with the preceding seven. Ten-day declines compare two adjacent ten-day periods. These fixed comparisons retain location/channel/product filters but override the historical date selector. The broader demand chart and transaction table use the selected period.

## 5. Replenishment & Forecasts

Review suggested HO replenishment, store rotations and HO production candidates by variant and destination. Targets combine selected cover with three assumed lead-time days. Incoming units with a timely ETA reduce the gap. Suggestions can change when demo cover settings change.

Precomputed forecasts cover November 2026–January 2027 for the network. They are split into variant sizes and have a separate forecast CSV. They do not retrain when location, channel, date range or cover changes. No observed baseline is shown as insufficient evidence.

Size-pack tables show observed sales mix, exposure, stockout days and peak/non-peak cover quantities. **Fast seller stockouts** narrows this report. Completed receipts show actual fixture dispatch-to-receipt elapsed days; in-transit rows retain partial receipts and remaining quantities. Three assumed lead days in a suggestion are different from those historical elapsed days.

## 6. Events & Influencers

The year selector controls the calendar independently of the sales date filter. Referenced festival dates have source URLs; shopping windows and multipliers are simulated. Creator records are fictional and linked to products and dates. Demand overlays make timing visible, but do not prove that a creator caused sales growth.

## 7. Dupatta Analysis

Explicit outfit–dupatta mappings drive the report. Attachment uses known with/without matching sales, while unknown observations are displayed separately. Coverage allocates each shared dupatta unit once across the selected outfit relationships; filter scope can therefore change allocation. Standalone dupatta stock remains visible. The prototype assumes a one-to-one ratio and does not infer that unrelated products match from colour or imagery.

## 8. Settings

Settings persist in this browser/device, not in a shared company account. Reset restores defaults. Cover, peak cover, minimum units, core sizes, inactivity days, trend thresholds, fast/slow rates, sell-through thresholds and freshness days recompute supported local reports. Forecasts stay precomputed.

Defaults: 14-day normal cover, 28-day peak cover, minimum one unit, core S/M/L/XL, 60-day inactivity, 30% increase/decline thresholds, fast rate 0.5 units/day, slow rate 0.1 units/day, Hit at 60% sell-through, Average at 20%, freshness within 90 days. These are demo assumptions, not The Loom's policies.

## Exports and unavailable states

The primary CSV depends on the current section: attention signals, inventory rows, store assortment, sales lines, suggestions, calendar events or dupatta coverage. Settings has no report export. Forecasts have an additional dedicated export. Supplementary charts and tables are not all bundled into the primary CSV. Date/year context follows each report's rules above. CSV formula-like text is escaped.

An empty report means no rows match the filter. A missing image means the remote source could not be rendered. An unavailable percentage or cover value means its denominator/baseline is absent. The asynchronous provider has loading and retry/error states. None of these states silently replaces missing evidence with a fabricated value.

## Local preview and troubleshooting

From the repository, run `npm ci`, then `npm run dev` and keep that process running. Open `http://127.0.0.1:3000`. For production preview use `npm run build`, then `npm start`. A localhost URL works only on the computer running the process. If it reports connection refused, restart the preview; if port 3000 is occupied, use `npm run dev -- --port 3001` and open that port. The mock JSON is committed, so no database credentials are required.
