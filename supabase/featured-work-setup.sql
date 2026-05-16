-- Run this once in Supabase SQL Editor for the M-Machine project.
-- It creates the live featured-work table and public image bucket.

create table if not exists public.featured_work (
  id text primary key,
  title text not null,
  description text not null default '',
  tag text not null default 'Bespoke',
  year integer not null default extract(year from now())::integer,
  category text not null default 'Fabrication',
  full_story text not null default '',
  image_url text,
  image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_featured_work_updated_at on public.featured_work;
create trigger set_featured_work_updated_at
before update on public.featured_work
for each row
execute function public.set_updated_at();

alter table public.featured_work enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'featured-work',
  'featured-work',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into public.featured_work (
  id,
  title,
  description,
  tag,
  year,
  category,
  full_story,
  image_url,
  image_path,
  created_at
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
  now() - interval '4 minutes'
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
  now() - interval '3 minutes'
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
  now() - interval '2 minutes'
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
  now() - interval '1 minute'
)
on conflict (id) do nothing;

