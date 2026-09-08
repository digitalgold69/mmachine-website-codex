CREATE TABLE IF NOT EXISTS catalogue_overrides (
  catalogue TEXT PRIMARY KEY CHECK (catalogue IN ('mini', 'metals')),
  products_key TEXT NOT NULL,
  pdf_key TEXT,
  source_key TEXT,
  source_filename TEXT NOT NULL,
  source_size INTEGER NOT NULL DEFAULT 0,
  product_count INTEGER NOT NULL DEFAULT 0,
  version TEXT NOT NULL,
  uploaded_at TEXT NOT NULL,
  uploaded_by TEXT
);
