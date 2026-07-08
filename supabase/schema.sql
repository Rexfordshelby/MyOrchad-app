-- MyOrchard Supabase launch schema.
-- Run this in the Supabase SQL editor or from a trusted backend environment.
-- Keep database pooler URLs and service-role keys out of the frontend app.

create extension if not exists pgcrypto;

create table if not exists public.app_admins (
  email text primary key,
  created_at timestamptz not null default now()
);

insert into public.app_admins (email)
values
  ('raashifshaikh70@gmail.com'),
  ('admin@myorchard.app'),
  ('admin@kalpavrikshaagro.com'),
  ('team@kalpavrikshaagro.com')
on conflict (email) do nothing;

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  role text not null check (role in ('farmer', 'supporter', 'admin')),
  mobile text,
  location text,
  bio text,
  preferred_language text not null default 'en' check (preferred_language in ('en', 'mr')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.orchards add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.orchards add column if not exists updated_at timestamptz not null default now();

create table if not exists public.verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  farmer_name text not null,
  farm_name text not null,
  district text not null,
  village text,
  acres numeric(8, 2) not null default 0,
  crop text not null default 'Cashew',
  mobile text,
  bank_name text,
  account_number text,
  status text not null default 'Pending' check (status in ('Pending', 'Verified', 'Needs review')),
  total_trees integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.verifications add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.verifications add column if not exists village text;
alter table public.verifications add column if not exists acres numeric(8, 2) not null default 0;
alter table public.verifications add column if not exists crop text not null default 'Cashew';
alter table public.verifications add column if not exists mobile text;
alter table public.verifications add column if not exists bank_name text;
alter table public.verifications add column if not exists account_number text;
alter table public.verifications add column if not exists updated_at timestamptz not null default now();

create unique index if not exists verifications_farm_farmer_key
  on public.verifications (farm_name, farmer_name);

create table if not exists public.farmer_updates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  orchard_slug text references public.orchards(slug) on delete set null,
  title text not null,
  body text not null,
  photo_names text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.farmer_updates add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.farmer_updates add column if not exists photo_names text[] not null default '{}';

create table if not exists public.adoptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  supporter_name text not null,
  supporter_mobile text,
  orchard_slug text references public.orchards(slug) on delete set null,
  tree_count integer not null default 1 check (tree_count > 0),
  total_amount integer not null default 5000,
  payment_method text not null default 'UPI',
  payment_status text not null default 'Paid',
  certificate_id text unique,
  created_at timestamptz not null default now()
);

alter table public.adoptions add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.adoptions add column if not exists supporter_mobile text;
alter table public.adoptions add column if not exists payment_method text not null default 'UPI';
alter table public.adoptions add column if not exists certificate_id text;

create unique index if not exists adoptions_certificate_id_key
  on public.adoptions (certificate_id)
  where certificate_id is not null;

create table if not exists public.program_settings (
  id text primary key default 'program',
  adoption_amount integer not null default 5000,
  crop_focus text not null default 'Cashew',
  verification_requirement text not null default 'KYC, location, tree count',
  update_frequency text not null default 'Monthly',
  launch_districts text not null default 'Sindhudurg, Ratnagiri, Kolhapur',
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.program_settings (id)
values ('program')
on conflict (id) do nothing;

alter table public.app_admins enable row level security;
alter table public.user_profiles enable row level security;
alter table public.orchards enable row level security;
alter table public.verifications enable row level security;
alter table public.farmer_updates enable row level security;
alter table public.adoptions enable row level security;
alter table public.program_settings enable row level security;

drop policy if exists "users can check own admin email" on public.app_admins;
create policy "users can check own admin email"
  on public.app_admins for select
  using (lower(email) = lower(auth.jwt() ->> 'email'));

drop policy if exists "users can read own profile" on public.user_profiles;
create policy "users can read own profile"
  on public.user_profiles for select
  using (
    auth.uid() = user_id
    or exists (select 1 from public.app_admins a where lower(a.email) = lower(auth.jwt() ->> 'email'))
  );

drop policy if exists "users can insert own profile" on public.user_profiles;
create policy "users can insert own profile"
  on public.user_profiles for insert
  with check (auth.uid() = user_id);

drop policy if exists "users can update own profile" on public.user_profiles;
create policy "users can update own profile"
  on public.user_profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "public can read orchards" on public.orchards;
create policy "public can read orchards"
  on public.orchards for select
  using (true);

drop policy if exists "admins can manage orchards" on public.orchards;
create policy "admins can manage orchards"
  on public.orchards for all
  using (exists (select 1 from public.app_admins a where lower(a.email) = lower(auth.jwt() ->> 'email')))
  with check (exists (select 1 from public.app_admins a where lower(a.email) = lower(auth.jwt() ->> 'email')));

drop policy if exists "users can read own verifications or admins read all" on public.verifications;
drop policy if exists "authenticated interface can read verifications" on public.verifications;
create policy "users can read own verifications or admins read all"
  on public.verifications for select
  using (
    auth.uid() = user_id
    or exists (select 1 from public.app_admins a where lower(a.email) = lower(auth.jwt() ->> 'email'))
  );

drop policy if exists "farmers can insert own verification" on public.verifications;
create policy "farmers can insert own verification"
  on public.verifications for insert
  with check (auth.uid() = user_id);

drop policy if exists "farmers can update pending own verification" on public.verifications;
create policy "farmers can update pending own verification"
  on public.verifications for update
  using (auth.uid() = user_id and status <> 'Verified')
  with check (auth.uid() = user_id);

drop policy if exists "admins can update verifications" on public.verifications;
create policy "admins can update verifications"
  on public.verifications for update
  using (exists (select 1 from public.app_admins a where lower(a.email) = lower(auth.jwt() ->> 'email')))
  with check (exists (select 1 from public.app_admins a where lower(a.email) = lower(auth.jwt() ->> 'email')));

drop policy if exists "public can read farmer updates" on public.farmer_updates;
create policy "public can read farmer updates"
  on public.farmer_updates for select
  using (true);

drop policy if exists "farmers can insert own updates" on public.farmer_updates;
create policy "farmers can insert own updates"
  on public.farmer_updates for insert
  with check (auth.uid() = user_id);

drop policy if exists "users can read own adoptions or admins read all" on public.adoptions;
drop policy if exists "authenticated interface can read adoptions" on public.adoptions;
create policy "users can read own adoptions or admins read all"
  on public.adoptions for select
  using (
    auth.uid() = user_id
    or exists (select 1 from public.app_admins a where lower(a.email) = lower(auth.jwt() ->> 'email'))
  );

drop policy if exists "supporters can insert own adoptions" on public.adoptions;
create policy "supporters can insert own adoptions"
  on public.adoptions for insert
  with check (auth.uid() = user_id);

drop policy if exists "public can read program settings" on public.program_settings;
drop policy if exists "authenticated users can read program settings" on public.program_settings;
create policy "public can read program settings"
  on public.program_settings for select
  using (true);

drop policy if exists "admins can manage program settings" on public.program_settings;
create policy "admins can manage program settings"
  on public.program_settings for all
  using (exists (select 1 from public.app_admins a where lower(a.email) = lower(auth.jwt() ->> 'email')))
  with check (exists (select 1 from public.app_admins a where lower(a.email) = lower(auth.jwt() ->> 'email')));
