-- Run this once in Supabase SQL Editor for live order / quote requests.

create table if not exists public.quote_requests (
  id text primary key,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'new'
    check (status in ('new', 'reviewing', 'invoice_sent', 'paid', 'closed')),
  customer jsonb not null,
  items jsonb not null,
  owner_notes text not null default '',
  customer_message text not null default '',
  carriage_ex_vat numeric,
  extra_charges_ex_vat numeric,
  quoted_at timestamptz,
  invoice_sent_at timestamptz,
  paid_at timestamptz,
  customer_email_sent_at timestamptz,
  owner_email_sent_at timestamptz
);

alter table public.quote_requests enable row level security;

drop trigger if exists set_quote_requests_updated_at on public.quote_requests;
create trigger set_quote_requests_updated_at
before update on public.quote_requests
for each row
execute function public.set_updated_at();

create index if not exists quote_requests_submitted_at_idx
on public.quote_requests (submitted_at desc);
