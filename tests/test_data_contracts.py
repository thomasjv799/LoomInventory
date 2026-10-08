"""Checks for the normalized handoff and proposed API; no credentials required."""
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import sqlite3
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("export_seed", ROOT / "scripts/export_database_seed.py")
seed = importlib.util.module_from_spec(spec)
spec.loader.exec_module(seed)


class DataContracts(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data, cls.tables, cls.specs = seed.build()

    def test_relational_import_and_business_reconciliation(self):
        db = seed.validate(self.data, self.tables, self.specs)
        self.assertEqual(db.execute("PRAGMA integrity_check").fetchone()[0], "ok")
        db.close()

    def test_manifest_checksums_counts_and_load_order(self):
        manifest = json.loads((seed.OUT / "manifest.json").read_text())
        self.assertTrue(manifest["synthetic"])
        self.assertEqual(manifest["load_order"], ["organizations", *self.tables])
        for name, descriptor in manifest["files"].items():
            content = (seed.OUT / descriptor["path"]).read_bytes()
            self.assertEqual(hashlib.sha256(content).hexdigest(), descriptor["sha256"], name)
            self.assertEqual(len(content.splitlines()), descriptor["rows"], name)
            if name in self.tables:
                self.assertEqual([json.loads(line) for line in content.splitlines()], self.tables[name])

    def test_export_is_deterministic(self):
        self.assertEqual(seed.build(), (self.data, self.tables, self.specs))
        self.assertEqual(json.loads((seed.OUT / "table-contract.json").read_text()), self.specs)

    def test_database_rejects_bad_bin_location_and_duplicate_deduction(self):
        db = seed.validate(self.data, self.tables, self.specs)
        with self.assertRaises(sqlite3.IntegrityError):
            db.execute("UPDATE inventory_ledger SET location_id='S1' WHERE id='O0001'")
        with self.assertRaises(sqlite3.IntegrityError):
            db.execute("INSERT INTO sales_lines SELECT org_id,'duplicate',order_id,variant_id,quantity,transaction_mrp_minor,net_line_value_minor,movement_id,matching_status,matching_dupatta_id FROM sales_lines LIMIT 1")
        db.close()

    def test_cross_organization_reference_is_rejected(self):
        db = seed.validate(self.data, self.tables, self.specs)
        db.execute("INSERT INTO organizations VALUES ('other','Other','INR','Asia/Kolkata')")
        with self.assertRaises(sqlite3.IntegrityError):
            db.execute("INSERT INTO reservations VALUES ('other','r','P001-M','HO',1,'2026-10-06')")
        db.close()

    def test_order_headers_and_prices_preserved(self):
        orders = {row["id"]: row for row in self.tables["sales_orders"]}
        source = {row["id"]: row for row in self.data["sales"]}
        for line in self.tables["sales_lines"]:
            original = source[line["id"]]
            header = orders[line["order_id"]]
            self.assertEqual((header["sale_date"], header["location_id"], header["channel"]),
                             (original["date"], original["locationId"], original["channel"]))
            self.assertEqual(line["transaction_mrp_minor"], original["mrp"])
            self.assertEqual(line["net_line_value_minor"], original["netValue"])

    def test_forecasts_reconcile_at_product_month(self):
        variant_products = {v["id"]: v["productId"] for v in self.data["variants"]}
        totals = {}
        for row in self.tables["forecast_values"]:
            key = (variant_products[row["variant_id"]], row["month"])
            totals[key] = totals.get(key, 0) + row["units"]
        self.assertEqual(totals, {(f["productId"], f["month"]): f["units"] for f in self.data["forecasts"]})

    def test_contract_references_and_operation_ids(self):
        api = json.loads((ROOT / "docs/api/openapi.json").read_text())
        self.assertEqual(api["openapi"], "3.1.0")
        self.assertEqual(api["security"], [{"bearerAuth": []}])
        def visit(node):
            if isinstance(node, dict):
                if "$ref" in node:
                    value = api
                    for part in node["$ref"][2:].split("/"):
                        value = value[part]
                for item in node.values():
                    visit(item)
            elif isinstance(node, list):
                for item in node:
                    visit(item)
        visit(api)
        ids = []
        for path, operations in api["paths"].items():
            for method, operation in operations.items():
                ids.append(operation["operationId"])
                self.assertEqual(operation["x-implementation-status"], "proposed")
                if method in ("post", "patch"):
                    self.assertTrue(any(p["name"] == "Idempotency-Key" and p["required"] for p in operation["parameters"]))
                path_keys = set(re.findall(r"\{([^}]+)\}", path))
                declared = {p["name"] for p in operation["parameters"] if p["in"] == "path" and p["required"]}
                self.assertEqual(path_keys, declared)
        self.assertEqual(len(ids), len(set(ids)))

    def test_field_contract_contains_all_scoped_constraints(self):
        self.assertEqual(self.specs["organizations"]["primary_key"], ["id"])
        self.assertEqual(self.specs["inventory_ledger"]["primary_key"], ["org_id", "id"])
        fks = self.specs["inventory_ledger"]["composite_foreign_keys"]
        self.assertIn({"columns": ["org_id"], "table": "organizations", "references": ["id"]}, fks)
        self.assertIn({"columns": ["org_id", "bin_id", "location_id"], "table": "bins", "references": ["org_id", "id", "location_id"]}, fks)

    def test_api_boolean_mapping_and_generation_parity(self):
        api_spec = importlib.util.spec_from_file_location("api_builder", ROOT / "scripts/build_api_contract.py")
        builder = importlib.util.module_from_spec(api_spec)
        api_spec.loader.exec_module(builder)
        api = json.loads((ROOT / "docs/api/openapi.json").read_text())
        self.assertEqual(api, builder.build())
        self.assertEqual(api["components"]["schemas"]["Bins"]["properties"]["excluded"]["type"], "boolean")
        self.assertEqual(api["components"]["schemas"]["InventoryLedger"]["properties"]["is_opening"]["type"], "boolean")

    def test_document_links_exist(self):
        for document in [ROOT / "README.md", *list((ROOT / "docs").glob("*.md"))]:
            for link in re.findall(r"\]\(([^)]+)\)", document.read_text()):
                if "://" in link or link.startswith("#"):
                    continue
                self.assertTrue((document.parent / link.split("#")[0]).exists(), f"{document.name}: {link}")


if __name__ == "__main__":
    unittest.main()
