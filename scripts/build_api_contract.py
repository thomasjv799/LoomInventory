"""Build a reviewable OpenAPI 3.1 design artifact, not a running API."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def ref(name):
    return {"$ref": f"#/components/schemas/{name}"}


def obj(properties, required=None):
    return {"type": "object", "additionalProperties": False, "properties": properties,
            "required": list(properties) if required is None else required}


def array(schema):
    return {"type": "array", "items": schema}


S = {"type": "string"}
I = {"type": "integer", "minimum": 0}
N = {"type": ["number", "null"]}
B = {"type": "boolean"}
D = {"type": "string", "format": "date"}
M = {"type": ["integer", "null"], "minimum": 0, "maximum": 9007199254740991, "description": "INR paise. Net line value is a line total; MRP is per unit."}


def build():
    schemas = {}
    contracts = json.loads((ROOT / "data/normalized/table-contract.json").read_text())
    names = {k: "".join(part.title() for part in k.split("_")) for k in contracts}
    for table, contract in contracts.items():
        fields = {}
        for name, sql_type in contract["columns"].items():
            kind = sql_type.split()[0]
            typ = {"INTEGER": "integer", "BIGINT": "integer", "NUMERIC": "number"}.get(kind, "string")
            value = {"type": typ if "NOT NULL" in sql_type else [typ, "null"]}
            if name in ("excluded", "is_opening"):
                value = {"type": "boolean"}
            if kind == "DATE":
                value["format"] = "date"
            if name.endswith("_minor"):
                value.update({"minimum": 0, "maximum": 9007199254740991, "description": "INR paise"})
            fields[name] = value
        schemas[names[table]] = obj(fields)
    schemas["Error"] = obj({"code": S, "message": S, "request_id": S,
                            "details": array(obj({"field": S, "issue": S}))})
    schemas["Meta"] = obj({"request_id": S, "as_of": D, "synthetic": B, "currency": {"const": "INR"},
                           "money_unit": {"const": "paise"}, "timezone": {"const": "Asia/Kolkata"},
                           "settings_version": S, "snapshot_id": S,
                           "applied_filters": {"type": "object", "additionalProperties": {"type": ["string", "boolean", "integer"]}},
                           "ignored_filters": array(S), "warnings": array(S),
                           "page": {"type": ["integer", "null"], "minimum": 1},
                           "page_size": {"type": ["integer", "null"], "minimum": 1, "maximum": 100}, "total_rows": I})
    schemas["InventoryRow"] = obj({"product_id": S, "variant_id": S, "sku": S, "size": S, "location_id": S,
                                   **{k: I for k in ["physical", "sellable", "excluded", "quarantine", "reserved", "available", "in_transit", "sold", "stockout_days", "exposure"]},
                                   "rate": {"type": "number", "minimum": 0}, "cover_days": N,
                                   "status": {"enum": ["Stockout", "Low stock", "Healthy"]}, "last_sale": {"type": ["string", "null"], "format": "date"}})
    schemas["InventoryTotals"] = obj({k: I for k in ["physical", "sellable", "excluded", "quarantine", "reserved", "available", "in_transit", "rows"]})
    schemas["AttentionRow"] = obj({"product_id": S, "variant_id": S, "location_id": S, "signal": S, "units": I, "report_url": S})
    schemas["OverviewSummary"] = obj({"available_units": I, "selling_size_stockouts": I, "broken_options": I, "inactive_units": I, "in_transit_units": I})
    schemas["StoreHealthRow"] = obj({"location_id": S, "product_id": S, "healthy": B, "missing_sizes": array(S),
                                    "available_units": I, "sold_units": I, "sellthrough_pct": N, "fresh": B,
                                    "classification": {"enum": ["Hit", "Average", "Miss", "Insufficient data"]}})
    schemas["RecommendationRow"] = obj({"id": S, "product_id": S, "variant_id": S, "size": S, "source_id": S, "destination_id": S,
                                        "quantity": I, "rate": {"type": "number"}, "available": I, "incoming": I,
                                        "target": I, "lead_days": I, "kind": {"enum": ["Replenish", "Rotate"]}, "reason": S,
                                        "plan_snapshot_id": S})
    schemas["HoShortageRow"] = obj({"product_id": S, "variant_id": S, "size": S, "rate": {"type": "number"}, "available": I, "suggested_units": I, "cover_days": I, "reason": S})
    schemas["SalesReportRow"] = obj({**schemas["SalesLines"]["properties"], "product_id": S, "sku": S, "size": S, "location_id": S, "channel": {"enum": ["Ecommerce", "Store"]}, "sale_date": D})
    schemas["TransferStatusRow"] = obj({**schemas["Transfers"]["properties"], "received_qty": I, "in_transit_qty": I, "received_date": {"type": ["string", "null"], "format": "date"}, "elapsed_days": {"type": ["integer", "null"], "minimum": 0}})
    schemas["TrendRow"] = obj({"product_id": S, "window_days": {"enum": [7, 10]}, "current_start": D, "current_end": D,
                               "previous_start": D, "previous_end": D, "current_units": I, "previous_units": I, "change_pct": N})
    schemas["AttributeRow"] = obj({"attribute": S, "value": S, "units": I, "known_revenue_minor": M,
                                   "priced_units": I, "unpriced_units": I, "selling_styles": I, "units_per_selling_style": N})
    schemas["PriceBandRow"] = obj({"name": S, "minimum_minor": I, "maximum_minor": {"type": ["integer", "null"]}, "units": I})
    schemas["SizeMixRow"] = obj({"size": S, "units": I, "share_pct": N})
    schemas["SalesSummary"] = obj({"units": I, "known_revenue_minor": M, "priced_units": I, "unpriced_units": I})
    schemas["ForecastRow"] = obj({"run_id": S, "product_id": S, "variant_id": S, "size": S, "month": {"type": "string", "pattern": "^[0-9]{4}-(0[1-9]|1[0-2])$"},
                                  "units": I, "factor": {"type": "number"}, "method": S, "scope": {"const": "network"},
                                  "status": {"const": "precomputed_demo"}, "evidence": {"enum": ["observed_baseline", "insufficient"]}})
    schemas["DupattaRow"] = obj({"outfit_id": S, "dupatta_id": S, "with_units": I, "without_units": I, "unknown_units": I,
                                 "attachment_pct": N, "outfits_available": I, "pairs_covered": I, "shortage": I, "coverage_pct": N})
    schemas["TimelinePoint"] = obj({"date": D, "units": I, "known_revenue_minor": M, "event_ids": array(S), "activity_ids": array(S)})
    schemas["SizePackRow"] = obj({"product_id": S, "variant_id": S, "location_id": S, "size": S, "rate": {"type": "number"},
                                   "exposure": I, "stockout_days": I, "weight_pct": N, "suggested_units": I, "cover_days": I})
    settings = {k: {"type": "integer", "minimum": 1, "maximum": 365} for k in ["cover", "peak_cover", "minimum", "dead_days", "fresh_days"]}
    settings.update({k: {"type": "number", "minimum": 0, "maximum": 100} for k in ["spike", "drop", "hit", "average"]})
    settings.update({"fast": {"type": "number", "minimum": 0}, "slow": {"type": "number", "minimum": 0},
                     "core_sizes": {"type": "array", "items": S, "minItems": 1, "uniqueItems": True}, "peak": B})
    schemas["SettingsValues"] = obj(settings)
    schemas["SettingsDocument"] = obj({"version": S, "values": ref("SettingsValues"), "forecast_recomputed": {"const": False}})
    schemas["ImportDryRun"] = obj({"dataset": {"enum": ["product-master", "opening-ho", "opening-stores", "ho-additions", "ho-reductions", "ecommerce-sales", "store-sales", "influencer-activity", "event-calendar", "bin-data", "store-transit"]},
                                  "source_system": S, "source_batch_id": S, "schema_version": {"const": "1.0.0"},
                                  "rows": {"type": "array", "minItems": 1, "maxItems": 10000, "items": {"type": "object", "additionalProperties": True}}})
    schemas["ImportResult"] = obj({"id": S, "status": {"enum": ["validated", "rejected", "committed"]}, "valid_rows": I,
                                  "rejected_rows": I, "content_hash": S, "errors": array(obj({"row": I, "field": S, "code": S, "message": S}))})
    schemas["TransferDispatch"] = obj({"variant_id": S, "source_id": S, "destination_id": S,
                                      "quantity": {"type": "integer", "minimum": 1}, "eta": D, "reason": S})
    schemas["TransferReceiptRequest"] = obj({"quantity": {"type": "integer", "minimum": 1}, "bin_id": S,
                                            "condition": {"enum": ["sellable", "quarantine"]}, "received_date": D, "source_reference": S})

    def envelope(name, data, extra=None):
        schemas[name] = obj({"data": data, "meta": ref("Meta"), **(extra or {})})
        return ref(name)

    paths = {}
    common = {
        "location_id": S, "channel": {"enum": ["Ecommerce", "Store"]}, "from": D, "to": D,
        "q": {"type": "string", "maxLength": 200}, "category": S, "fabric": S, "color": S, "craft": S, "size": S,
        "status": {"enum": ["Stockout", "Low stock", "Healthy", "Selling stockout", "Inactive"]},
        "page": {"type": "integer", "minimum": 1, "default": 1},
        "page_size": {"type": "integer", "minimum": 1, "maximum": 100, "default": 25},
        "sort": S, "direction": {"enum": ["asc", "desc"], "default": "asc"}}

    def operation(path, method, summary, response, filters=None, body=None, role="viewer", stage="read", extra_parameters=None):
        parameters = [{"name": k, "in": "query", "required": False, "schema": common[k]} for k in (filters or [])]
        for piece in path.split("/"):
            if piece.startswith("{"):
                parameters.append({"name": piece[1:-1], "in": "path", "required": True, "schema": S})
        parameters += extra_parameters or []
        if method in ["post", "patch"]:
            parameters += [{"name": "Idempotency-Key", "in": "header", "required": True, "schema": {"type": "string", "minLength": 8, "maxLength": 128}}]
        errors = {str(code): {"description": text, "content": {"application/json": {"schema": ref("Error")}}}
                  for code, text in [(401, "Authentication required"), (403, "Not authorized for this scope"), (404, "Resource not found"), (409, "Stock, idempotency or version conflict"), (422, "Invalid request"), (429, "Rate limit") ]}
        op = {"operationId": method + "_" + path.strip("/").replace("/", "_").replace("{", "").replace("}", "").replace("-", "_"),
              "summary": summary, "tags": [stage], "x-minimum-role": role, "x-implementation-status": "proposed",
              "parameters": parameters, "responses": {"200": {"description": "Successful authorized response", "content": {"application/json": {"schema": response}}}, **errors}}
        if body:
            op["requestBody"] = {"required": True, "content": {"application/json": {"schema": body}}}
        paths.setdefault(path, {})[method] = op

    base_filters = ["location_id", "channel", "from", "to", "q", "category", "fabric", "color", "craft", "size"]
    pages = ["page", "page_size", "sort", "direction"]
    operation("/locations", "get", "Locations allowed for the current membership", envelope("LocationsResponse", array(ref("Locations"))), pages)
    operation("/products", "get", "Filter the product catalogue", envelope("ProductsResponse", array(ref("Products"))), ["q", "category", "fabric", "color", "craft", "size", *pages])
    product_detail = obj({"product": ref("Products"), "images": array(ref("ProductImages")), "variants": array(ref("Variants")),
                          "availability": array(ref("InventoryRow")), "movements": array(ref("InventoryLedger")),
                          "trend": array(ref("TimelinePoint")), "recommendations": array(ref("RecommendationRow"))})
    operation("/products/{product_id}", "get", "Product drawer within authorized locations; movement history bounded to requested period", envelope("ProductDetailResponse", product_detail), ["location_id", "from", "to"])
    operation("/inventory", "get", "Current variant-location stock and filtered totals", envelope("InventoryResponse", array(ref("InventoryRow")), {"totals": ref("InventoryTotals")}), [*base_filters, "status", *pages])
    operation("/reports/overview", "get", "Overview metrics and paginated attention signals", envelope("OverviewResponse", array(ref("AttentionRow")), {"summary": ref("OverviewSummary")}), [*base_filters, "status", *pages])
    operation("/reports/stores", "get", "Store assortment health", envelope("StoresResponse", array(ref("StoreHealthRow"))), [*base_filters, *pages])
    operation("/reports/rotation", "get", "Feasible rotations from one shared network allocation plan", envelope("RotationResponse", array(ref("RecommendationRow"))), [*base_filters, *pages])
    operation("/sales", "get", "Transaction-level sales with original pricing", envelope("SalesResponse", array(ref("SalesReportRow")), {"summary": ref("SalesSummary")}), [*base_filters, *pages])
    operation("/reports/sales", "get", "Attribute performance, actual price bands, size mix and fixed trends", envelope("SalesReportResponse", obj({"summary": ref("SalesSummary"), "attributes": array(ref("AttributeRow")), "price_bands": array(ref("PriceBandRow")), "size_mix": array(ref("SizeMixRow")), "trends": array(ref("TrendRow")), "timeline": array(ref("TimelinePoint"))})), base_filters)
    operation("/reports/replenishment", "get", "Cover-based replenishment recommendations from one network plan", envelope("ReplenishmentResponse", array(ref("RecommendationRow"))), [*base_filters, "status", *pages])
    operation("/reports/ho-shortages", "get", "Recently selling HO sizes requiring production", envelope("HoShortagesResponse", array(ref("HoShortageRow"))), [*base_filters, *pages])
    operation("/reports/slow-stock", "get", "Available slow or inactive store stock for outward review", envelope("SlowStockResponse", array(ref("InventoryRow"))), [*base_filters, *pages])
    operation("/reports/size-packs", "get", "Stockout exposure and cover-based size suggestions", envelope("SizePacksResponse", array(ref("SizePackRow"))), [*base_filters, *pages], extra_parameters=[{"name": "fast_only", "in": "query", "schema": B}])
    operation("/reports/forecasts", "get", "Precomputed network size forecasts; ignored filters declared", envelope("ForecastResponse", array(ref("ForecastRow"))), [*base_filters, *pages])
    operation("/transfers", "get", "Dispatched transfer lines; receipts carry their received quantities", envelope("TransfersResponse", array(ref("TransferStatusRow"))), ["location_id", "from", "to", *pages])
    operation("/transfers/{transfer_id}/receipts", "get", "Partial and completed receipt history", envelope("TransferReceiptsResponse", array(ref("TransferReceipts"))), pages)
    operation("/reports/events", "get", "Calendar independent of sales dates; activity and demand overlays", envelope("EventsResponse", obj({"events": array(ref("Events")), "activities": array(ref("InfluencerActivity")), "timeline": array(ref("TimelinePoint"))})), base_filters, extra_parameters=[{"name": "year", "in": "query", "schema": {"type": "integer", "minimum": 2000, "maximum": 2100, "default": 2026}}])
    operation("/reports/dupatta", "get", "Matching attachment and shared-pool coverage", envelope("DupattaResponse", array(ref("DupattaRow"))), [*base_filters, *pages])
    operation("/settings", "get", "Read organization settings and version", envelope("SettingsResponse", ref("SettingsDocument")))
    operation("/settings", "patch", "Replace supported settings with optimistic version check", ref("SettingsResponse"), body=ref("SettingsValues"), role="administrator", stage="future-write", extra_parameters=[{"name": "If-Match", "in": "header", "required": True, "schema": S}])
    operation("/imports/dry-run", "post", "Validate sheet-like data without stock writes", envelope("ImportResponse", ref("ImportResult")), body=ref("ImportDryRun"), role="inventory_operator", stage="future-import")
    operation("/imports/{import_id}/commit", "post", "Commit a validated content hash atomically", ref("ImportResponse"), body=obj({"content_hash": S}), role="inventory_operator", stage="future-import")
    operation("/transfers", "post", "Dispatch a one-variant transfer atomically; revalidate live availability", envelope("TransferResponse", ref("Transfers")), body=ref("TransferDispatch"), role="inventory_operator", stage="future-write")
    operation("/transfers/{transfer_id}/receipts", "post", "Record a partial receipt and destination ledger entry atomically", envelope("ReceiptResponse", ref("TransferReceipts")), body=ref("TransferReceiptRequest"), role="inventory_operator", stage="future-write")
    export_filters = [*base_filters, "status", "sort", "direction"]
    params = [{"name": k, "in": "query", "schema": common[k]} for k in export_filters]
    params += [{"name": "report", "in": "query", "required": True, "schema": {"enum": ["overview", "inventory", "stores", "sales", "replenishment", "events", "dupatta", "forecasts"]}},
               {"name": "year", "in": "query", "schema": {"type": "integer"}}]
    paths["/exports"]= {"get": {"operationId": "get_exports", "summary": "All filtered rows of the primary report; same scope and snapshot as JSON", "tags": ["read"], "x-implementation-status": "proposed", "parameters": params,
        "responses": {"200": {"description": "CSV attachment with formula-like text escaped. No pagination. Max 100000 rows; reject larger synchronous requests with 422 until asynchronous export jobs exist.",
                                 "headers": {"Content-Disposition": {"schema": S}, "X-Snapshot-ID": {"schema": S}},
                                 "content": {"text/csv": {"schema": S}}},
                      "401": {"description": "Authentication required", "content": {"application/json": {"schema": ref("Error")}}},
                      "403": {"description": "Forbidden", "content": {"application/json": {"schema": ref("Error")}}},
                      "422": {"description": "Invalid filter or export too large", "content": {"application/json": {"schema": ref("Error")}}}}}}
    return {"openapi": "3.1.0", "info": {"title": "The Loom Inventory Studio — proposed FastAPI contract", "version": "0.1.0",
                                        "description": "Design artifact only. No API is implemented or deployed. Data, prices and operations are synthetic; private backend planned for the next milestone."},
            "servers": [{"url": "http://127.0.0.1:8000/api/v1", "description": "Proposed local backend, not currently running"}],
            "security": [{"bearerAuth": []}], "paths": paths,
            "tags": [{"name": "read", "description": "Initial backend read milestone"}, {"name": "future-import", "description": "Later validated import workflows"}, {"name": "future-write", "description": "Later transactional operations"}],
            "components": {"securitySchemes": {"bearerAuth": {"type": "http", "scheme": "bearer", "bearerFormat": "JWT"}}, "schemas": schemas}}


if __name__ == "__main__":
    output = ROOT / "docs/api/openapi.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(build(), indent=2, ensure_ascii=False) + "\n")
    print("Generated proposed OpenAPI 3.1 contract.")
