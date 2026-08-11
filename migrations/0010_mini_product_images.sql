CREATE TABLE IF NOT EXISTS mini_product_images (
  product_id TEXT PRIMARY KEY,
  image_key TEXT NOT NULL,
  content_type TEXT NOT NULL,
  uploaded_at TEXT NOT NULL
);
