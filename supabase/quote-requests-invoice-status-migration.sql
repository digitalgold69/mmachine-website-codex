-- Run this once if quote_requests already exists.
-- It keeps old rows, renames the old "quoted" state to "invoice_sent",
-- and adds the paid tracking needed by the owner dashboard.

alter table public.quote_requests
add column if not exists invoice_sent_at timestamptz;

alter table public.quote_requests
add column if not exists paid_at timestamptz;

alter table public.quote_requests
drop constraint if exists quote_requests_status_check;

update public.quote_requests
set
  status = 'invoice_sent',
  invoice_sent_at = coalesce(invoice_sent_at, customer_email_sent_at, quoted_at, updated_at)
where status = 'quoted';

alter table public.quote_requests
add constraint quote_requests_status_check
check (status in ('new', 'reviewing', 'invoice_sent', 'paid', 'closed'));

create index if not exists quote_requests_status_idx
on public.quote_requests (status);

create index if not exists quote_requests_paid_at_idx
on public.quote_requests (paid_at desc);
