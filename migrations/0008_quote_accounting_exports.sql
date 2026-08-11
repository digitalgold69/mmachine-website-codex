ALTER TABLE quote_requests
  ADD COLUMN include_vat INTEGER NOT NULL DEFAULT 1;

ALTER TABLE quote_requests
  ADD COLUMN website_invoice_number TEXT;

ALTER TABLE quote_requests
  ADD COLUMN refunds TEXT NOT NULL DEFAULT '[]';

CREATE UNIQUE INDEX IF NOT EXISTS quote_requests_website_invoice_number_idx
  ON quote_requests(website_invoice_number);

CREATE TABLE IF NOT EXISTS accounting_sequences (
  name TEXT PRIMARY KEY,
  next_number INTEGER NOT NULL
);

INSERT INTO accounting_sequences (name, next_number)
VALUES ('website_invoice', 1234)
ON CONFLICT(name) DO NOTHING;
