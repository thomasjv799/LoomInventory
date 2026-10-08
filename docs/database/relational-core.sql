-- Portable reference core; SQLite-tested. See database-design.md.
CREATE TABLE organizations (
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  currency TEXT NOT NULL,
  timezone TEXT NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE locations (
  org_id TEXT NOT NULL,
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  kind TEXT NOT NULL,
  PRIMARY KEY (org_id, id),
  FOREIGN KEY (org_id) REFERENCES organizations(id),
  CHECK (kind IN ('warehouse','store'))
);

CREATE TABLE bins (
  org_id TEXT NOT NULL,
  id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  name TEXT NOT NULL,
  excluded INTEGER NOT NULL,
  PRIMARY KEY (org_id, id),
  FOREIGN KEY (org_id) REFERENCES organizations(id),
  FOREIGN KEY (org_id, location_id) REFERENCES locations(org_id, id),
  CHECK (excluded IN (0,1)),
  UNIQUE (org_id, id, location_id)
);

CREATE TABLE products (
  org_id TEXT NOT NULL,
  id TEXT NOT NULL,
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  color TEXT NOT NULL,
  fabric TEXT NOT NULL,
  craft TEXT NOT NULL,
  style TEXT NOT NULL,
  collection TEXT NOT NULL,
  season TEXT NOT NULL,
  kurta_length_inches INTEGER NOT NULL,
  launch_date DATE NOT NULL,
  cost_minor BIGINT NOT NULL,
  suggested_mrp_minor BIGINT NOT NULL,
  provenance_json TEXT NOT NULL,
  PRIMARY KEY (org_id, id),
  FOREIGN KEY (org_id) REFERENCES organizations(id),
  CHECK (cost_minor >= 0),
  CHECK (suggested_mrp_minor >= 0),
  UNIQUE (org_id, sku)
);

CREATE TABLE product_images (
  org_id TEXT NOT NULL,
  id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  url TEXT NOT NULL,
  source_product_url TEXT NOT NULL,
  alt TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  verified_on DATE NOT NULL,
  PRIMARY KEY (org_id, id),
  FOREIGN KEY (org_id) REFERENCES organizations(id),
  FOREIGN KEY (org_id, product_id) REFERENCES products(org_id, id),
  CHECK (width IS NULL OR width > 0),
  CHECK (height IS NULL OR height > 0)
);

CREATE TABLE variants (
  org_id TEXT NOT NULL,
  id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  sku TEXT NOT NULL,
  size TEXT NOT NULL,
  PRIMARY KEY (org_id, id),
  FOREIGN KEY (org_id) REFERENCES organizations(id),
  FOREIGN KEY (org_id, product_id) REFERENCES products(org_id, id),
  UNIQUE (org_id, sku),
  UNIQUE (org_id, product_id, size)
);

CREATE TABLE transfers (
  org_id TEXT NOT NULL,
  id TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  destination_id TEXT NOT NULL,
  dispatched_qty INTEGER NOT NULL,
  dispatch_date DATE NOT NULL,
  eta DATE NOT NULL,
  owner_org_id TEXT NOT NULL,
  PRIMARY KEY (org_id, id),
  FOREIGN KEY (org_id) REFERENCES organizations(id),
  FOREIGN KEY (org_id, variant_id) REFERENCES variants(org_id, id),
  FOREIGN KEY (org_id, source_id) REFERENCES locations(org_id, id),
  FOREIGN KEY (org_id, destination_id) REFERENCES locations(org_id, id),
  CHECK (dispatched_qty > 0),
  CHECK (source_id <> destination_id),
  CHECK (owner_org_id = org_id)
);

CREATE TABLE inventory_ledger (
  org_id TEXT NOT NULL,
  id TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  bin_id TEXT NOT NULL,
  condition TEXT NOT NULL,
  quantity_delta INTEGER NOT NULL,
  effective_date DATE NOT NULL,
  reason TEXT NOT NULL,
  source_reference TEXT,
  is_opening INTEGER NOT NULL,
  transfer_id TEXT,
  owner_org_id TEXT NOT NULL,
  PRIMARY KEY (org_id, id),
  FOREIGN KEY (org_id) REFERENCES organizations(id),
  FOREIGN KEY (org_id, variant_id) REFERENCES variants(org_id, id),
  FOREIGN KEY (org_id, location_id) REFERENCES locations(org_id, id),
  FOREIGN KEY (org_id, bin_id) REFERENCES bins(org_id, id),
  FOREIGN KEY (org_id, transfer_id) REFERENCES transfers(org_id, id),
  FOREIGN KEY (org_id, bin_id, location_id) REFERENCES bins(org_id, id, location_id),
  CHECK (condition IN ('sellable','quarantine')),
  CHECK (is_opening IN (0,1)),
  CHECK (owner_org_id = org_id)
);

CREATE TABLE transfer_receipts (
  org_id TEXT NOT NULL,
  id TEXT NOT NULL,
  transfer_id TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  received_date DATE NOT NULL,
  movement_id TEXT NOT NULL,
  PRIMARY KEY (org_id, id),
  FOREIGN KEY (org_id) REFERENCES organizations(id),
  FOREIGN KEY (org_id, transfer_id) REFERENCES transfers(org_id, id),
  FOREIGN KEY (org_id, movement_id) REFERENCES inventory_ledger(org_id, id),
  CHECK (quantity > 0),
  UNIQUE (org_id, movement_id)
);

CREATE TABLE sales_orders (
  org_id TEXT NOT NULL,
  id TEXT NOT NULL,
  source_reference TEXT NOT NULL,
  location_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  sale_date DATE NOT NULL,
  PRIMARY KEY (org_id, id),
  FOREIGN KEY (org_id) REFERENCES organizations(id),
  FOREIGN KEY (org_id, location_id) REFERENCES locations(org_id, id),
  CHECK (channel IN ('Ecommerce','Store'))
);

CREATE TABLE sales_lines (
  org_id TEXT NOT NULL,
  id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  transaction_mrp_minor BIGINT,
  net_line_value_minor BIGINT,
  movement_id TEXT NOT NULL,
  matching_status TEXT NOT NULL,
  matching_dupatta_id TEXT,
  PRIMARY KEY (org_id, id),
  FOREIGN KEY (org_id) REFERENCES organizations(id),
  FOREIGN KEY (org_id, order_id) REFERENCES sales_orders(org_id, id),
  FOREIGN KEY (org_id, variant_id) REFERENCES variants(org_id, id),
  FOREIGN KEY (org_id, movement_id) REFERENCES inventory_ledger(org_id, id),
  FOREIGN KEY (org_id, matching_dupatta_id) REFERENCES products(org_id, id),
  CHECK (quantity > 0),
  CHECK (transaction_mrp_minor IS NULL OR transaction_mrp_minor >= 0),
  CHECK (net_line_value_minor IS NULL OR net_line_value_minor >= 0),
  CHECK (matching_status IN ('with','without','unknown')),
  UNIQUE (org_id, movement_id)
);

CREATE TABLE reservations (
  org_id TEXT NOT NULL,
  id TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  as_of DATE NOT NULL,
  PRIMARY KEY (org_id, id),
  FOREIGN KEY (org_id) REFERENCES organizations(id),
  FOREIGN KEY (org_id, variant_id) REFERENCES variants(org_id, id),
  FOREIGN KEY (org_id, location_id) REFERENCES locations(org_id, id),
  CHECK (quantity > 0)
);

CREATE TABLE matching_relationships (
  org_id TEXT NOT NULL,
  id TEXT NOT NULL,
  outfit_id TEXT NOT NULL,
  dupatta_id TEXT NOT NULL,
  ratio INTEGER NOT NULL,
  description TEXT NOT NULL,
  PRIMARY KEY (org_id, id),
  FOREIGN KEY (org_id) REFERENCES organizations(id),
  FOREIGN KEY (org_id, outfit_id) REFERENCES products(org_id, id),
  FOREIGN KEY (org_id, dupatta_id) REFERENCES products(org_id, id),
  CHECK (ratio > 0),
  CHECK (outfit_id <> dupatta_id)
);

CREATE TABLE events (
  org_id TEXT NOT NULL,
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  kind TEXT NOT NULL,
  multiplier NUMERIC NOT NULL,
  source_url TEXT,
  note TEXT,
  PRIMARY KEY (org_id, id),
  FOREIGN KEY (org_id) REFERENCES organizations(id),
  CHECK (start_date <= end_date),
  CHECK (multiplier > 0)
);

CREATE TABLE influencer_activity (
  org_id TEXT NOT NULL,
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  product_id TEXT NOT NULL,
  activity_date DATE NOT NULL,
  channel TEXT NOT NULL,
  note TEXT NOT NULL,
  PRIMARY KEY (org_id, id),
  FOREIGN KEY (org_id) REFERENCES organizations(id),
  FOREIGN KEY (org_id, product_id) REFERENCES products(org_id, id)
);

CREATE TABLE forecast_runs (
  org_id TEXT NOT NULL,
  id TEXT NOT NULL,
  as_of DATE NOT NULL,
  scope TEXT NOT NULL,
  status TEXT NOT NULL,
  assumptions_json TEXT NOT NULL,
  PRIMARY KEY (org_id, id),
  FOREIGN KEY (org_id) REFERENCES organizations(id)
);

CREATE TABLE forecast_values (
  org_id TEXT NOT NULL,
  id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  month TEXT NOT NULL,
  units INTEGER NOT NULL,
  factor NUMERIC NOT NULL,
  method TEXT NOT NULL,
  PRIMARY KEY (org_id, id),
  FOREIGN KEY (org_id) REFERENCES organizations(id),
  FOREIGN KEY (org_id, run_id) REFERENCES forecast_runs(org_id, id),
  FOREIGN KEY (org_id, variant_id) REFERENCES variants(org_id, id),
  CHECK (units >= 0),
  CHECK (factor > 0),
  UNIQUE (org_id, run_id, variant_id, month)
);

CREATE INDEX ledger_variant_location_date ON inventory_ledger(org_id, variant_id, location_id, effective_date);

CREATE INDEX sales_orders_location_date ON sales_orders(org_id, location_id, sale_date);

CREATE INDEX sales_lines_variant ON sales_lines(org_id, variant_id);

CREATE INDEX transfers_destination_eta ON transfers(org_id, destination_id, eta);
