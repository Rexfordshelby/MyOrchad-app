-- MyOrchard post-migration check.
-- Run this in the Supabase SQL editor after supabase/schema.sql.
-- Every returned row should have ok = true.

with required_tables(table_name) as (
  values
    ('app_admins'),
    ('user_profiles'),
    ('orchards'),
    ('verifications'),
    ('farmer_updates'),
    ('adoptions'),
    ('program_settings')
),
required_columns(table_name, column_name) as (
  values
    ('app_admins', 'email'),
    ('app_admins', 'created_at'),
    ('user_profiles', 'user_id'),
    ('user_profiles', 'email'),
    ('user_profiles', 'full_name'),
    ('user_profiles', 'role'),
    ('user_profiles', 'preferred_language'),
    ('user_profiles', 'updated_at'),
    ('orchards', 'slug'),
    ('orchards', 'name'),
    ('orchards', 'farmer_name'),
    ('orchards', 'district'),
    ('orchards', 'village'),
    ('orchards', 'total_trees'),
    ('orchards', 'adopted_trees'),
    ('orchards', 'available_trees'),
    ('orchards', 'farmer_income'),
    ('verifications', 'id'),
    ('verifications', 'user_id'),
    ('verifications', 'farmer_name'),
    ('verifications', 'farm_name'),
    ('verifications', 'district'),
    ('verifications', 'village'),
    ('verifications', 'acres'),
    ('verifications', 'crop'),
    ('verifications', 'status'),
    ('verifications', 'total_trees'),
    ('verifications', 'updated_at'),
    ('farmer_updates', 'id'),
    ('farmer_updates', 'user_id'),
    ('farmer_updates', 'orchard_slug'),
    ('farmer_updates', 'title'),
    ('farmer_updates', 'body'),
    ('farmer_updates', 'photo_names'),
    ('farmer_updates', 'created_at'),
    ('adoptions', 'id'),
    ('adoptions', 'user_id'),
    ('adoptions', 'supporter_name'),
    ('adoptions', 'supporter_mobile'),
    ('adoptions', 'orchard_slug'),
    ('adoptions', 'tree_count'),
    ('adoptions', 'total_amount'),
    ('adoptions', 'payment_method'),
    ('adoptions', 'payment_status'),
    ('adoptions', 'certificate_id'),
    ('adoptions', 'created_at'),
    ('program_settings', 'id'),
    ('program_settings', 'adoption_amount'),
    ('program_settings', 'crop_focus'),
    ('program_settings', 'verification_requirement'),
    ('program_settings', 'update_frequency'),
    ('program_settings', 'launch_districts'),
    ('program_settings', 'updated_by'),
    ('program_settings', 'updated_at')
),
required_admins(email) as (
  values
    ('raashifshaikh70@gmail.com'),
    ('admin@myorchard.app'),
    ('admin@kalpavrikshaagro.com'),
    ('team@kalpavrikshaagro.com')
),
required_policies(table_name, policy_name) as (
  values
    ('app_admins', 'users can check own admin email'),
    ('user_profiles', 'users can read own profile'),
    ('user_profiles', 'users can insert own profile'),
    ('user_profiles', 'users can update own profile'),
    ('orchards', 'public can read orchards'),
    ('orchards', 'admins can manage orchards'),
    ('verifications', 'users can read own verifications or admins read all'),
    ('verifications', 'farmers can insert own verification'),
    ('verifications', 'farmers can update pending own verification'),
    ('verifications', 'admins can update verifications'),
    ('farmer_updates', 'public can read farmer updates'),
    ('farmer_updates', 'farmers can insert own updates'),
    ('adoptions', 'users can read own adoptions or admins read all'),
    ('adoptions', 'farmers can read orchard adoptions'),
    ('adoptions', 'supporters can insert own adoptions'),
    ('program_settings', 'public can read program settings'),
    ('program_settings', 'admins can manage program settings')
),
table_status as (
  select
    'tables' as section,
    'required tables exist' as check_name,
    count(*) filter (where to_regclass('public.' || table_name) is null) = 0 as ok,
    coalesce(string_agg(table_name, ', ') filter (where to_regclass('public.' || table_name) is null), 'ready') as detail
  from required_tables
),
column_status as (
  select
    'columns' as section,
    'required app columns exist' as check_name,
    count(*) filter (where c.column_name is null) = 0 as ok,
    coalesce(string_agg(rc.table_name || '.' || rc.column_name, ', ') filter (where c.column_name is null), 'ready') as detail
  from required_columns rc
  left join information_schema.columns c
    on c.table_schema = 'public'
   and c.table_name = rc.table_name
   and c.column_name = rc.column_name
),
admin_status as (
  select
    'admin seed' as section,
    'admin emails exist' as check_name,
    count(*) filter (where a.email is null) = 0 as ok,
    coalesce(string_agg(ra.email, ', ') filter (where a.email is null), 'ready') as detail
  from required_admins ra
  left join public.app_admins a
    on lower(a.email) = lower(ra.email)
),
rls_status as (
  select
    'rls' as section,
    'required tables have RLS enabled' as check_name,
    count(*) filter (where c.relrowsecurity is distinct from true) = 0 as ok,
    coalesce(string_agg(rt.table_name, ', ') filter (where c.relrowsecurity is distinct from true), 'ready') as detail
  from required_tables rt
  left join pg_class c
    on c.oid = to_regclass('public.' || rt.table_name)
),
policy_status as (
  select
    'policies' as section,
    'required RLS policies exist' as check_name,
    count(*) filter (where p.policyname is null) = 0 as ok,
    coalesce(string_agg(rp.table_name || ': ' || rp.policy_name, ', ') filter (where p.policyname is null), 'ready') as detail
  from required_policies rp
  left join pg_policies p
    on p.schemaname = 'public'
   and p.tablename = rp.table_name
   and p.policyname = rp.policy_name
),
trigger_status as (
  select
    'triggers' as section,
    'adoption inventory triggers exist' as check_name,
    count(*) = 2 as ok,
    count(*)::text || ' of 2 triggers found' as detail
  from pg_trigger
  where tgrelid = 'public.adoptions'::regclass
    and tgname in ('ensure_adoption_inventory', 'apply_adoption_inventory')
),
index_status as (
  select
    'indexes' as section,
    'unique guard indexes exist' as check_name,
    count(*) = 3 as ok,
    count(*)::text || ' of 3 indexes found' as detail
  from pg_indexes
  where schemaname = 'public'
    and indexname in ('orchards_slug_key', 'verifications_farm_farmer_key', 'adoptions_certificate_id_key')
)
select * from table_status
union all select * from column_status
union all select * from admin_status
union all select * from rls_status
union all select * from policy_status
union all select * from trigger_status
union all select * from index_status
order by section, check_name;
