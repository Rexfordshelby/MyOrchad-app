-- MyOrchard Supabase starter schema.
-- Run this in the Supabase SQL editor or from a trusted backend environment.
-- Do not place the Postgres pooler/database password in the frontend app.

create extension if not exists pgcrypto;

create table if not exists public.orchards (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  farmer_name text not null,
  district text not null,
  village text not null,
  state text not null default 'Maharashtra',
  acres numeric(8, 2) not null default 0,
  total_trees integer not null default 0,
  adopted_trees integer not null default 0,
  available_trees integer not null default 0,
  rating numeric(3, 1) not null default 4.7,
  farmer_income integer not null default 0,
  image_url text,
  coordinates text,
  summary text,
  created_at timestamptz not null default now()
);

create table if not exists public.verifications (
  id uuid primary key default gen_random_uuid(),
  farmer_name text not null,
  farm_name text not null,
  district text not null,
  status text not null default 'Pending',
  total_trees integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.farmer_updates (
  id uuid primary key default gen_random_uuid(),
  orchard_slug text references public.orchards(slug) on delete set null,
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.adoptions (
  id uuid primary key default gen_random_uuid(),
  supporter_name text not null,
  orchard_slug text references public.orchards(slug) on delete set null,
  tree_count integer not null default 1,
  total_amount integer not null default 5000,
  farmer_share integer not null default 2000,
  ecosystem_share integer not null default 3000,
  payment_status text not null default 'Paid',
  created_at timestamptz not null default now()
);

alter table public.orchards enable row level security;
alter table public.verifications enable row level security;
alter table public.farmer_updates enable row level security;
alter table public.adoptions enable row level security;

drop policy if exists "public can read orchards" on public.orchards;
create policy "public can read orchards"
  on public.orchards for select
  using (true);

drop policy if exists "public can read farmer updates" on public.farmer_updates;
create policy "public can read farmer updates"
  on public.farmer_updates for select
  using (true);

drop policy if exists "prototype can read verifications" on public.verifications;
create policy "prototype can read verifications"
  on public.verifications for select
  using (true);

drop policy if exists "prototype can read adoptions" on public.adoptions;
create policy "prototype can read adoptions"
  on public.adoptions for select
  using (true);

insert into public.orchards
  (slug, name, farmer_name, district, village, acres, total_trees, adopted_trees, available_trees, rating, farmer_income, coordinates, summary)
values
  ('patil', 'Patil Cashew Farm', 'Suresh Patil', 'Ratnagiri', 'Malvan', 2.5, 1200, 850, 350, 4.8, 340000, '15.3949 N, 73.8278 E', 'A verified cashew orchard using natural farming practices and monthly photo updates.'),
  ('kadam', 'Kadam Orchard', 'Maya Kadam', 'Sindhudurg', 'Sawantwadi', 3.1, 980, 615, 365, 4.6, 246000, '15.9042 N, 73.8216 E', 'A family-run cashew orchard with clear geo-tagging and regular growth reports.'),
  ('naik', 'Naik Cashew Farm', 'Ramesh Naik', 'Kolhapur', 'Ajra', 4.0, 800, 410, 390, 4.7, 164000, '16.1169 N, 74.2104 E', 'A hillside cashew farm onboarding into the Kalpavriksha Agro verification program.')
on conflict (slug) do update set
  name = excluded.name,
  farmer_name = excluded.farmer_name,
  district = excluded.district,
  village = excluded.village,
  acres = excluded.acres,
  total_trees = excluded.total_trees,
  adopted_trees = excluded.adopted_trees,
  available_trees = excluded.available_trees,
  rating = excluded.rating,
  farmer_income = excluded.farmer_income,
  coordinates = excluded.coordinates,
  summary = excluded.summary;

insert into public.verifications
  (farmer_name, farm_name, district, status, total_trees)
values
  ('Ramesh Naik', 'Naik Cashew Farm', 'Kolhapur', 'Pending', 800),
  ('Maya Kadam', 'Kadam Orchard', 'Sindhudurg', 'Pending', 980),
  ('Suresh Patil', 'Patil Cashew Farm', 'Ratnagiri', 'Verified', 1200);

insert into public.farmer_updates
  (orchard_slug, title, body, created_at)
values
  ('naik', 'Flowering stage', 'Trees are healthy and flowering well after organic spray.', '2026-05-12 09:00:00+05:30'),
  ('naik', 'Irrigation completed', 'Drip irrigation checked across the adopted tree rows.', '2026-04-22 09:00:00+05:30');
