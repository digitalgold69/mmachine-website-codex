ALTER TABLE quote_requests
  ADD COLUMN website_invoice_count INTEGER NOT NULL DEFAULT 1;

UPDATE accounting_sequences
SET next_number = coalesce((
  SELECT MAX(CAST(SUBSTR(website_invoice_number, 2) AS INTEGER) + coalesce(website_invoice_count, 1))
  FROM quote_requests
  WHERE website_invoice_number LIKE 'W%'
), next_number)
WHERE name = 'website_invoice'
  AND next_number < coalesce((
    SELECT MAX(CAST(SUBSTR(website_invoice_number, 2) AS INTEGER) + coalesce(website_invoice_count, 1))
    FROM quote_requests
    WHERE website_invoice_number LIKE 'W%'
  ), next_number);
