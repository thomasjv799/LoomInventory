"""Export the UI fixture as relational JSONL with a database-independent contract.

No credentials or running database required. SQLite checks the portable relational
core; the PostgreSQL draft adds private-schema protection, not production policies.
"""
from pathlib import Path
import hashlib
import json
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "normalized"
ORG = "loom-demo"


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def build():
    data = json.loads((ROOT / "data/mock-data.json").read_text())
    images = json.loads((ROOT / "data/image-manifest.json").read_text())
    tables = {}
    specs = {"organizations": {"columns": {"id": "TEXT NOT NULL", "name": "TEXT NOT NULL", "currency": "TEXT NOT NULL", "timezone": "TEXT NOT NULL"},
                                "primary_key": ["id"], "foreign_keys": {}, "composite_foreign_keys": [], "checks": [], "unique": []}}

    def table(name, fields, rows, foreign_keys=None, checks=None, unique=None):
        # All business identities are scoped to the organization, including FKs.
        columns = {"org_id": "TEXT NOT NULL", "id": "TEXT NOT NULL", **fields}
        references = [{"columns": ["org_id"], "table": "organizations", "references": ["id"]}]
        references += [{"columns": ["org_id", col], "table": target, "references": ["org_id", "id"]} for col, target in (foreign_keys or {}).items()]
        if name == "inventory_ledger":
            references += [{"columns": ["org_id", "bin_id", "location_id"], "table": "bins", "references": ["org_id", "id", "location_id"]}]
        specs[name] = {"columns": columns, "primary_key": ["org_id", "id"], "foreign_keys": foreign_keys or {},
                       "composite_foreign_keys": references, "checks": checks or [], "unique": unique or []}
        tables[name] = [{"org_id": ORG, **row} for row in rows]

    table("locations", {"name": "TEXT NOT NULL", "city": "TEXT NOT NULL", "kind": "TEXT NOT NULL"},
          [{"id": x["id"], "name": x["name"], "city": x["city"], "kind": x["type"]} for x in data["locations"]],
          checks=["kind IN ('warehouse','store')"])
    table("bins", {"location_id": "TEXT NOT NULL", "name": "TEXT NOT NULL", "excluded": "INTEGER NOT NULL"},
          [{"id": x["id"], "location_id": x["locationId"], "name": x["name"], "excluded": int(x["excluded"])} for x in data["bins"]],
          {"location_id": "locations"}, ["excluded IN (0,1)"], ["id, location_id"])
    product_fields = {k: "TEXT NOT NULL" for k in ["sku", "name", "category", "color", "fabric", "craft", "style", "collection", "season"]}
    product_fields.update({"kurta_length_inches": "INTEGER NOT NULL", "launch_date": "DATE NOT NULL",
                           "cost_minor": "BIGINT NOT NULL", "suggested_mrp_minor": "BIGINT NOT NULL", "provenance_json": "TEXT NOT NULL"})
    table("products", product_fields, [
        {**{k: x[k] for k in ["id", "sku", "name", "category", "color", "fabric", "craft", "style", "collection", "season"]},
         "kurta_length_inches": x["kurtaLength"], "launch_date": x["launchDate"], "cost_minor": x["cost"],
         "suggested_mrp_minor": x["suggestedMrp"], "provenance_json": canonical(x["provenance"])} for x in data["products"]],
          checks=["cost_minor >= 0", "suggested_mrp_minor >= 0"], unique=["sku"])
    table("product_images", {"product_id": "TEXT NOT NULL", "url": "TEXT NOT NULL", "source_product_url": "TEXT NOT NULL",
                            "alt": "TEXT NOT NULL", "width": "INTEGER", "height": "INTEGER", "verified_on": "DATE NOT NULL"},
          [{"id": x["id"] + "-primary", "product_id": x["id"], "url": x["primaryImageUrl"],
            "source_product_url": x["sourceProductUrl"], "alt": x["alt"], "width": x["images"][0]["width"] or None,
            "height": x["images"][0]["height"] or None, "verified_on": x["verifiedOn"]} for x in images],
          {"product_id": "products"}, ["width IS NULL OR width > 0", "height IS NULL OR height > 0"])
    table("variants", {"product_id": "TEXT NOT NULL", "sku": "TEXT NOT NULL", "size": "TEXT NOT NULL"},
          [{"id": x["id"], "product_id": x["productId"], "sku": x["sku"], "size": x["size"]} for x in data["variants"]],
          {"product_id": "products"}, unique=["sku", "product_id, size"])
    table("transfers", {"variant_id": "TEXT NOT NULL", "source_id": "TEXT NOT NULL", "destination_id": "TEXT NOT NULL",
                        "dispatched_qty": "INTEGER NOT NULL", "dispatch_date": "DATE NOT NULL", "eta": "DATE NOT NULL", "owner_org_id": "TEXT NOT NULL"},
          [{"id": x["id"], "variant_id": x["variantId"], "source_id": x["source"], "destination_id": x["destination"],
            "dispatched_qty": x["dispatched"], "dispatch_date": x["dispatchDate"], "eta": x["eta"], "owner_org_id": ORG} for x in data["transfers"]],
          {"variant_id": "variants", "source_id": "locations", "destination_id": "locations"},
          ["dispatched_qty > 0", "source_id <> destination_id", "owner_org_id = org_id"])
    transfer_ids = {x["id"] for x in data["transfers"]}
    ledger = []
    for opening, source in [(True, data["openingInventory"]), (False, data["movements"])]:
        for x in source:
            ledger.append({"id": x["id"], "variant_id": x["variantId"], "location_id": x["locationId"], "bin_id": x["binId"],
                           "condition": x["condition"], "quantity_delta": x["quantity"], "effective_date": x["date"],
                           "reason": x["reason"], "source_reference": x["reference"], "is_opening": int(opening),
                           "transfer_id": x["reference"] if x["reference"] in transfer_ids else None, "owner_org_id": ORG})
    table("inventory_ledger", {"variant_id": "TEXT NOT NULL", "location_id": "TEXT NOT NULL", "bin_id": "TEXT NOT NULL",
                              "condition": "TEXT NOT NULL", "quantity_delta": "INTEGER NOT NULL", "effective_date": "DATE NOT NULL",
                              "reason": "TEXT NOT NULL", "source_reference": "TEXT", "is_opening": "INTEGER NOT NULL",
                              "transfer_id": "TEXT", "owner_org_id": "TEXT NOT NULL"}, ledger,
          {"variant_id": "variants", "location_id": "locations", "bin_id": "bins", "transfer_id": "transfers"},
          ["condition IN ('sellable','quarantine')", "is_opening IN (0,1)", "owner_org_id = org_id"])
    table("transfer_receipts", {"transfer_id": "TEXT NOT NULL", "quantity": "INTEGER NOT NULL", "received_date": "DATE NOT NULL", "movement_id": "TEXT NOT NULL"},
          [{"id": x["id"] + "-receipt", "transfer_id": x["id"], "quantity": x["received"], "received_date": x["receivedDate"],
            "movement_id": next(m["id"] for m in data["movements"] if m["reference"] == x["id"] and m["locationId"] == x["destination"] and m["quantity"] > 0)}
           for x in data["transfers"] if x["received"] > 0],
          {"transfer_id": "transfers", "movement_id": "inventory_ledger"}, ["quantity > 0"], ["movement_id"])
    # Legacy bill references were reused. Include date/location/channel to avoid
    # silently merging distinct orders; leave the original bill reference intact.
    orders = {}
    sales = []
    for x in data["sales"]:
        order_id = "|".join([x["orderId"], x["date"], x["locationId"], x["channel"]])
        orders[order_id] = {"id": order_id, "source_reference": x["orderId"], "location_id": x["locationId"], "channel": x["channel"], "sale_date": x["date"]}
        sales.append({"id": x["id"], "order_id": order_id, "variant_id": x["variantId"], "quantity": x["quantity"],
                      "transaction_mrp_minor": x["mrp"], "net_line_value_minor": x["netValue"], "movement_id": x["movementId"],
                      "matching_status": x["matchingStatus"], "matching_dupatta_id": x.get("matchingDupattaId")})
    table("sales_orders", {"source_reference": "TEXT NOT NULL", "location_id": "TEXT NOT NULL", "channel": "TEXT NOT NULL", "sale_date": "DATE NOT NULL"},
          [orders[k] for k in sorted(orders)], {"location_id": "locations"}, ["channel IN ('Ecommerce','Store')"])
    table("sales_lines", {"order_id": "TEXT NOT NULL", "variant_id": "TEXT NOT NULL", "quantity": "INTEGER NOT NULL",
                          "transaction_mrp_minor": "BIGINT", "net_line_value_minor": "BIGINT", "movement_id": "TEXT NOT NULL",
                          "matching_status": "TEXT NOT NULL", "matching_dupatta_id": "TEXT"}, sales,
          {"order_id": "sales_orders", "variant_id": "variants", "movement_id": "inventory_ledger", "matching_dupatta_id": "products"},
          ["quantity > 0", "transaction_mrp_minor IS NULL OR transaction_mrp_minor >= 0", "net_line_value_minor IS NULL OR net_line_value_minor >= 0",
           "matching_status IN ('with','without','unknown')"], ["movement_id"])
    table("reservations", {"variant_id": "TEXT NOT NULL", "location_id": "TEXT NOT NULL", "quantity": "INTEGER NOT NULL", "as_of": "DATE NOT NULL"},
          [{"id": "R%04d" % i, "variant_id": x["variantId"], "location_id": x["locationId"], "quantity": x["quantity"], "as_of": data["asOf"]}
           for i, x in enumerate(data["reservations"], 1)], {"variant_id": "variants", "location_id": "locations"}, ["quantity > 0"])
    table("matching_relationships", {"outfit_id": "TEXT NOT NULL", "dupatta_id": "TEXT NOT NULL", "ratio": "INTEGER NOT NULL", "description": "TEXT NOT NULL"},
          [{"id": x["outfitId"] + ":" + x["dupattaId"], "outfit_id": x["outfitId"], "dupatta_id": x["dupattaId"],
            "ratio": x["ratio"], "description": x["relationship"]} for x in data["matchingRelationships"]],
          {"outfit_id": "products", "dupatta_id": "products"}, ["ratio > 0", "outfit_id <> dupatta_id"])
    table("events", {"name": "TEXT NOT NULL", "start_date": "DATE NOT NULL", "end_date": "DATE NOT NULL", "kind": "TEXT NOT NULL",
                     "multiplier": "NUMERIC NOT NULL", "source_url": "TEXT", "note": "TEXT"},
          [{"id": x["id"], "name": x["name"], "start_date": x["start"], "end_date": x["end"], "kind": x["kind"],
            "multiplier": x["multiplier"], "source_url": x.get("sourceUrl"), "note": x.get("note")} for x in data["events"]],
          checks=["start_date <= end_date", "multiplier > 0"])
    table("influencer_activity", {"name": "TEXT NOT NULL", "kind": "TEXT NOT NULL", "product_id": "TEXT NOT NULL", "activity_date": "DATE NOT NULL", "channel": "TEXT NOT NULL", "note": "TEXT NOT NULL"},
          [{"id": x["id"], "name": x["name"], "kind": x["type"], "product_id": x["productId"], "activity_date": x["date"], "channel": x["channel"], "note": x["note"]}
           for x in data["influencers"]], {"product_id": "products"})
    table("forecast_runs", {"as_of": "DATE NOT NULL", "scope": "TEXT NOT NULL", "status": "TEXT NOT NULL", "assumptions_json": "TEXT NOT NULL"},
          [{"id": "DEMO-20261006", "as_of": data["asOf"], "scope": "network", "status": "precomputed_demo",
            "assumptions_json": canonical({"baseline_days": 28, "seasonal_factors": "simulated", "allocation": "largest remainder of observed size mix", "lost_sales_model": False})}])
    table("forecast_values", {"run_id": "TEXT NOT NULL", "variant_id": "TEXT NOT NULL", "month": "TEXT NOT NULL", "units": "INTEGER NOT NULL", "factor": "NUMERIC NOT NULL", "method": "TEXT NOT NULL"},
          [{"id": x["variantId"] + ":" + x["month"], "run_id": "DEMO-20261006", "variant_id": x["variantId"],
            "month": x["month"], "units": x["units"], "factor": x["factor"], "method": x["method"]} for x in data["sizeForecasts"]],
          {"run_id": "forecast_runs", "variant_id": "variants"}, ["units >= 0", "factor > 0"], ["run_id, variant_id, month"])
    return data, tables, specs


def ddl(specs):
    sql = []
    for name, spec in specs.items():
        cols = [f"{k} {v}" for k, v in spec["columns"].items()]
        cols += ["PRIMARY KEY (" + ", ".join(spec["primary_key"]) + ")"]
        cols += ["FOREIGN KEY (" + ", ".join(fk["columns"]) + ") REFERENCES " + fk["table"] + "(" + ", ".join(fk["references"]) + ")" for fk in spec["composite_foreign_keys"]]
        cols += [f"CHECK ({check})" for check in spec["checks"]]
        cols += [f"UNIQUE (org_id, {keys})" for keys in spec["unique"]]
        sql.append(f"CREATE TABLE {name} (\n  " + ",\n  ".join(cols) + "\n);")
    sql += ["CREATE INDEX ledger_variant_location_date ON inventory_ledger(org_id, variant_id, location_id, effective_date);",
            "CREATE INDEX sales_orders_location_date ON sales_orders(org_id, location_id, sale_date);",
            "CREATE INDEX sales_lines_variant ON sales_lines(org_id, variant_id);",
            "CREATE INDEX transfers_destination_eta ON transfers(org_id, destination_id, eta);"]
    return "\n\n".join(sql) + "\n"


def validate(data, tables, specs):
    db = sqlite3.connect(":memory:")
    db.execute("PRAGMA foreign_keys = ON")
    db.executescript(ddl(specs))
    db.execute("INSERT INTO organizations VALUES (?,?,?,?)", (ORG, "The Loom demo", "INR", "Asia/Kolkata"))
    for name, rows in tables.items():
        cols = list(specs[name]["columns"])
        db.executemany(f"INSERT INTO {name} ({','.join(cols)}) VALUES ({','.join('?' for _ in cols)})", [[row[c] for c in cols] for row in rows])
    assert not db.execute("PRAGMA foreign_key_check").fetchall()
    actual = {(v, l, b, c): q for v, l, b, c, q in db.execute("SELECT variant_id, location_id, bin_id, condition, SUM(quantity_delta) FROM inventory_ledger GROUP BY variant_id, location_id, bin_id, condition")}
    expected = {(x["variantId"], x["locationId"], x["binId"], x["condition"]): x["quantity"] for x in data["balances"]}
    assert {k: v for k, v in actual.items() if v} == {k: v for k, v in expected.items() if v}, "ledger reconciliation failed"
    assert not db.execute("SELECT s.id FROM sales_lines s JOIN inventory_ledger m ON s.org_id=m.org_id AND s.movement_id=m.id JOIN sales_orders o ON s.org_id=o.org_id AND s.order_id=o.id WHERE m.quantity_delta <> -s.quantity OR m.variant_id <> s.variant_id OR m.location_id <> o.location_id OR m.effective_date <> o.sale_date").fetchall(), "sales movement mismatch"
    for t in data["transfers"]:
        qty = db.execute("SELECT COALESCE(SUM(quantity),0) FROM transfer_receipts WHERE transfer_id=?", (t["id"],)).fetchone()[0]
        assert t["dispatched"] - qty == t["inTransit"], "transit mismatch"
    assert db.execute("SELECT SUM(net_line_value_minor) FROM sales_lines").fetchone()[0] == sum(x["netValue"] or 0 for x in data["sales"])
    return db


def export():
    data, tables, specs = build()
    db = validate(data, tables, specs)
    OUT.mkdir(parents=True, exist_ok=True)
    organizations = [{"id": ORG, "name": "The Loom demo", "currency": "INR", "timezone": "Asia/Kolkata"}]
    manifest = {"schema_version": "1.0.0", "synthetic": True, "seed": 799, "as_of": data["asOf"],
                "money_unit": "INR paise; 100 minor units = 1 rupee", "load_order": ["organizations", *tables], "files": {}}
    for name, rows in {"organizations": organizations, **tables}.items():
        content = "".join(canonical(row) + "\n" for row in rows).encode()
        (OUT / f"{name}.jsonl").write_bytes(content)
        manifest["files"][name] = {"path": f"{name}.jsonl", "rows": len(rows), "sha256": hashlib.sha256(content).hexdigest()}
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    (OUT / "table-contract.json").write_text(json.dumps(specs, indent=2) + "\n")
    portable = ddl(specs)
    (ROOT / "docs/database/relational-core.sql").write_text("-- Portable reference core; SQLite-tested. See database-design.md.\n" + portable)
    pg = "-- DESIGN DRAFT, NOT A SUPABASE MIGRATION. Not applied to a live database.\nBEGIN;\nCREATE SCHEMA inventory;\nREVOKE ALL ON SCHEMA inventory FROM PUBLIC;\nSET LOCAL search_path TO inventory, pg_catalog;\n\n" + portable
    pg += "\n" + "\n".join(f"ALTER TABLE {name} ENABLE ROW LEVEL SECURITY;" for name in ["organizations", *tables])
    pg += "\nREVOKE ALL ON ALL TABLES IN SCHEMA inventory FROM PUBLIC;\nCOMMIT;\n"
    (ROOT / "docs/database/postgres-draft.sql").write_text(pg)
    db.close()
    print(f"Exported and relationally validated {len(tables)+1} tables, {sum(len(v) for v in tables.values())+1:,} rows.")


if __name__ == "__main__":
    export()
