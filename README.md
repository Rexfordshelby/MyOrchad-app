# MyOrchard App

Production-oriented web UI for Kalpavriksha Agro's MyOrchard program.

## Run locally

```bash
python -m http.server 5177 --bind 127.0.0.1
```

Open `http://127.0.0.1:5177/`.

## Access

- Farmer and Supporter use the sign-in/sign-up flow on the welcome screen.
- Team/admin tools are hidden from public users and only appear after signing in with an approved team email.
- Team emails currently allowed in the frontend gate:
  - `admin@myorchard.app`
  - `admin@kalpavrikshaagro.com`
  - `team@kalpavrikshaagro.com`
  - `raashifshaikh70@gmail.com`

## Notes

The app initializes the Supabase browser client with the project publishable key and anon fallback. On startup it restores the Supabase Auth session, reads `program_settings`, `orchards`, `verifications`, `farmer_updates`, and `adoptions`, and shows intentional empty states when no live rows are published.

The sign-in/sign-up flow uses Supabase Auth. New accounts may require email confirmation depending on the Supabase project setting. Admin access is checked against the `app_admins` table and should be enforced with the RLS policies in `supabase/schema.sql`.

Do not place the Postgres pooler/database connection string in this frontend repo. Keep it server-side only.

## Supabase setup

Run `supabase/schema.sql` in the Supabase SQL editor to create or upgrade the tables, triggers, and RLS policies expected by the UI. The schema includes profiles, admin email checks, farmer verification writes, adoption/certificate records, farmer updates, admin-managed program settings, and adoption inventory updates for orchard availability.

If Admin > Settings shows `Schema setup needed`, the frontend is connected to Supabase but the live project has not run the latest `supabase/schema.sql` yet.

You can verify the live project from this repo:

```bash
node tools/check-supabase-readiness.cjs
```

The checker reports missing tables and missing columns, so it is safe to run before and after applying the SQL.

You can also verify the frontend control contract:

```bash
node tools/check-ui-contract.cjs
```

That check fails if a rendered `data-action` button has no click handler, an export button has no CSV path, the admin email is not present in both the frontend and Supabase seed, Marathi language persistence is missing, or production-facing files contain fixture markers.

You can verify that the local Supabase SQL matches the app contract before sending it to the dashboard:

```bash
node tools/check-schema-contract.cjs
```

Before presenting the app as launch-ready, run the full gate:

```bash
node tools/check-launch-readiness.cjs
```

This command runs JavaScript syntax checks, frontend control checks, local SQL contract checks, and the live Supabase schema check in one pass.
