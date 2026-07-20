create table if not exists featured_work_prices (
  featured_id text primary key,
  price_ex_vat real check (price_ex_vat is null or price_ex_vat >= 0),
  updated_at text not null
);
