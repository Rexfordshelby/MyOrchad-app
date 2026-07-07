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

create unique index if not exists verifications_farm_farmer_key
  on public.verifications (farm_name, farmer_name);

create table if not exists public.farmer_updates (
  id uuid primary key default gen_random_uuid(),
  orchard_slug text references public.orchards(slug) on delete set null,
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists farmer_updates_seed_key
  on public.farmer_updates (orchard_slug, title, created_at);

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

drop policy if exists "authenticated interface can read verifications" on public.verifications;
create policy "authenticated interface can read verifications"
  on public.verifications for select
  using (true);

drop policy if exists "authenticated interface can read adoptions" on public.adoptions;
create policy "authenticated interface can read adoptions"
  on public.adoptions for select
  using (true);
