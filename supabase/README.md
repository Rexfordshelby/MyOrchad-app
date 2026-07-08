# Supabase Migration Runbook

Use this when applying the MyOrchard backend schema to the live Supabase project.

## Before Dashboard Work

Run the local SQL contract check:

```bash
node tools/check-schema-contract.cjs
```

It must pass before the SQL is sent to Supabase.

## Apply The Schema

1. Open the Supabase dashboard for project `kbrpjigxqchldjnjyuem`.
2. Go to SQL Editor and create a new query.
3. Paste the full contents of `supabase/schema.sql`.
4. Run the query once. The file is idempotent and can upgrade existing partial tables.
5. Keep server-only database URLs and service-role keys out of this frontend repo.

## Verify Inside Supabase

After `schema.sql` finishes, open another SQL Editor query and run:

```sql
-- Paste the contents of supabase/post-migration-check.sql
```

Every returned row should show `ok = true`.

## Verify From This Repo

Run the full launch gate:

```bash
node tools/check-launch-readiness.cjs
```

Launch is ready only when every section passes, including `Live Supabase schema`.

## Admin Access

The admin seed includes `raashifshaikh70@gmail.com`. After the launch gate passes, sign in with that email to confirm the admin navigation appears. Normal farmer and supporter accounts should not see admin tools.
