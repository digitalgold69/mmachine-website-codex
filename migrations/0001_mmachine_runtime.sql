create table if not exists quote_requests (
  id text primary key,
  submitted_at text not null,
  updated_at text not null,
  status text not null default 'new'
    check (status in ('new', 'reviewing', 'invoice_sent', 'paid', 'closed')),
  customer text not null,
  items text not null,
  owner_notes text not null default '',
  customer_message text not null default '',
  carriage_ex_vat real,
  extra_charges_ex_vat real,
  quoted_at text,
  invoice_sent_at text,
  paid_at text,
  paid_month_uk text,
  total_ex_vat real,
  customer_email_sent_at text,
  owner_email_sent_at text
);

create index if not exists quote_requests_submitted_at_idx
on quote_requests (submitted_at desc);

create index if not exists quote_requests_status_idx
on quote_requests (status);

create index if not exists quote_requests_paid_at_idx
on quote_requests (paid_at desc);

create index if not exists quote_requests_status_paid_at_idx
on quote_requests (status, paid_at desc);

create index if not exists quote_requests_paid_month_uk_idx
on quote_requests (status, paid_month_uk);

create table if not exists featured_work (
  id text primary key,
  title text not null,
  description text not null default '',
  tag text not null default 'Bespoke',
  year integer not null default 2026,
  category text not null default 'Fabrication',
  full_story text not null default '',
  image_url text,
  image_path text,
  created_at text not null,
  updated_at text not null
);

create index if not exists featured_work_created_at_idx
on featured_work (created_at desc);

create table if not exists featured_work_prices (
  featured_id text primary key,
  price_ex_vat real check (price_ex_vat is null or price_ex_vat >= 0),
  updated_at text not null
);

insert into featured_work (
  id,
  title,
  description,
  tag,
  year,
  category,
  full_story,
  image_url,
  image_path,
  created_at,
  updated_at
) values
(
  'f001',
  'Aluminium bonnet scoop',
  'Hand-formed from 2mm aluminium sheet for a 1275GT restoration. English wheel and shrinker-stretcher work throughout.',
  'Bespoke',
  2025,
  'Fabrication',
  'A customer brought us a partly-finished 1275GT restoration needing a functional scoop that matched original Works rally specification. We formed it by hand over a timber buck, using our English wheel to achieve the smooth crown and shrinker-stretcher to tighten the returns. Final finish hand-polished before paint.',
  null,
  null,
  '2026-06-15T12:00:00.000Z',
  '2026-06-15T12:00:00.000Z'
),
(
  'f002',
  'Stainless four-branch exhaust manifold',
  'TIG-welded 304 stainless four-branch for a Cooper S rally car. CAD-designed, mandrel-bent.',
  'Fabrication',
  2024,
  'Fabrication',
  'Design brief called for equal-length primaries with minimum ground clearance interference. Mandrel-bent primaries TIG-welded to a laser-cut collector plate. Full flow-benched before delivery.',
  null,
  null,
  '2026-06-15T12:01:00.000Z',
  '2026-06-15T12:01:00.000Z'
),
(
  'f003',
  'Hub carrier refurbishment',
  'Original hubs machined to spec, heat-treated and resurfaced. Back to better-than-new tolerances.',
  'Restoration',
  2024,
  'Engineering',
  'Badly pitted original hub carriers stripped, dimensionally surveyed, then machined back to drawing tolerance. Heat treated to Rc 58-62 and ground finished. Restored pieces exceed new-part tolerance.',
  null,
  null,
  '2026-06-15T12:02:00.000Z',
  '2026-06-15T12:02:00.000Z'
),
(
  'f004',
  'Bespoke battery tray relocation',
  'Custom-fabricated battery tray for a Mini engine bay relocation. Laser-cut, folded and powder-coated.',
  'One-off',
  2023,
  'Fabrication',
  'Engine bay relocation for a full race build required a compact, sealed battery tray in stainless. Designed in CAD, laser cut, folded and TIG welded in-house, then powder coated satin black.',
  null,
  null,
  '2026-06-15T12:03:00.000Z',
  '2026-06-15T12:03:00.000Z'
)
on conflict(id) do nothing;
